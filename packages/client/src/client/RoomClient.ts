/**
 * RoomClient - Main client class for connecting to a mediasoup room
 *
 * This is the new RoomClient implementation that uses:
 * - Signaling Layer: Generic signaling with pluggable backends
 * - Adapter Layer: Translates signaling to mediasoup operations
 * - Session State Machine: Manages session states and reconnection
 *
 * This client is stateful and imperative (not React-aware).
 */

import type { SignalingClient, SignalingClientOptions } from '../signaling/SignalingClient';
import { SignalingClient as SignalingClientImpl } from '../signaling/SignalingClient';
import type { MediasoupAdapter } from '../adapter/MediasoupAdapter';
import { MediasoupAdapter as MediasoupAdapterImpl } from '../adapter/MediasoupAdapter';
import type { RtpCapabilities } from '@bytepulse/pulsewave-shared';
import type {
  ClientIntent,
  ServerResponse,
  RoomInfo,
  ParticipantInfo,
  TrackInfo,
} from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('room-client');

/**
 * Room client options
 */
export interface RoomClientOptions {
  /**
   * Signaling client options
   */
  signaling: SignalingClientOptions;

  /**
   * Room name
   */
  room: string;

  /**
   * Authentication token
   */
  token: string;

  /**
   * Metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Room events
 */
export interface RoomEvents {
  /**
   * Connection state changed
   */
  'connection-state-changed': (
    state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  ) => void;

  /**
   * Room joined (presence-only)
   */
  'room-joined': (data: {
    room: RoomInfo;
    participant: ParticipantInfo;
    otherParticipants: ParticipantInfo[];
  }) => void;

  /**
   * Participant joined
   */
  'participant-joined': (participant: ParticipantInfo) => void;

  /**
   * Participant left
   */
  'participant-left': (participantSid: string) => void;

  /**
   * Call received
   */
  'call-received': (data: {
    callId: string;
    caller: ParticipantInfo;
    metadata?: Record<string, unknown>;
  }) => void;

  /**
   * Call accepted
   */
  'call-accepted': (data: { callId: string; participant: ParticipantInfo }) => void;

  /**
   * Call rejected
   */
  'call-rejected': (data: {
    callId: string;
    participant: ParticipantInfo;
    reason?: string;
  }) => void;

  /**
   * Call ended
   */
  'call-ended': (data: { callId: string; reason?: string }) => void;

  /**
   * Track published
   */
  'track-published': (data: { participantSid: string; track: TrackInfo }) => void;

  /**
   * Track unpublished
   */
  'track-unpublished': (data: { participantSid: string; trackSid: string }) => void;

  /**
   * Track subscribed
   */
  'track-subscribed': (data: { participantSid: string; track: TrackInfo }) => void;

  /**
   * Track unsubscribed
   */
  'track-unsubscribed': (data: { participantSid: string; trackSid: string }) => void;

  /**
   * Track muted
   */
  'track-muted': (data: { participantSid: string; trackSid: string }) => void;

  /**
   * Track unmuted
   */
  'track-unmuted': (data: { participantSid: string; trackSid: string }) => void;

  /**
   * Data received
   */
  'data-received': (data: {
    participantSid: string;
    payload: unknown;
    kind?: 'reliable' | 'lossy';
  }) => void;

  /**
   * Error
   */
  error: (error: Error) => void;
}

/**
 * RoomClient - Main RoomClient using the layered architecture
 */
export class RoomClient {
  private signalingClient: SignalingClient;
  private mediasoupAdapter: MediasoupAdapter | null = null;
  private roomInfo: RoomInfo | null = null;
  private localParticipant: ParticipantInfo | null = null;
  private participants: Map<string, ParticipantInfo> = new Map();
  private rtpCapabilities: RtpCapabilities | null = null;
  private eventListeners: Map<keyof RoomEvents, Set<RoomEvents[keyof RoomEvents]>> = new Map();

  constructor(private readonly options: RoomClientOptions) {
    // Initialize signaling client
    this.signalingClient = new SignalingClientImpl({
      transport: options.signaling.transport,
      transportImpl: options.signaling.transportImpl,
    });

    // Setup signaling client listeners
    this.setupSignalingListeners();
  }

  /**
   * Connect to the room (presence-only, no media)
   */
  async connect(): Promise<void> {
    logger.info('Connecting to room...');

    try {
      await this.signalingClient.connect();

      // Send join room intent
      this.sendIntent({
        type: 'join_room',
        room: this.options.room,
        token: this.options.token,
        metadata: this.options.metadata,
      });

      logger.info('Join room intent sent');
    } catch (error) {
      logger.error('Failed to connect:', { error });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Start a call (initiate media session)
   */
  async startCall(targetParticipantSid: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Starting call:', { targetParticipantSid });

    // Initialize mediasoup adapter if not already initialized
    if (!this.mediasoupAdapter) {
      await this.initializeMediasoupAdapter();
    }

    // Send start call intent
    this.sendIntent({
      type: 'start_call',
      targetParticipantSid,
      metadata,
    });

    logger.info('Start call intent sent');
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Accepting call:', { callId });

    // Initialize mediasoup adapter if not already initialized
    if (!this.mediasoupAdapter) {
      await this.initializeMediasoupAdapter();
    }

    // Send accept call intent
    this.sendIntent({
      type: 'accept_call',
      callId,
      metadata,
    });

    logger.info('Accept call intent sent');
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string, reason?: string): Promise<void> {
    logger.info('Rejecting call:', { callId, reason });

    // Send reject call intent
    this.sendIntent({
      type: 'reject_call',
      callId,
      reason,
    });

    logger.info('Reject call intent sent');
  }

  /**
   * End a call
   */
  async endCall(callId: string, reason?: string): Promise<void> {
    logger.info('Ending call:', { callId, reason });

    // Send end call intent
    this.sendIntent({
      type: 'end_call',
      callId,
      reason,
    });

    // Close mediasoup adapter
    if (this.mediasoupAdapter) {
      this.mediasoupAdapter.close();
      this.mediasoupAdapter = null;
    }

    logger.info('End call intent sent');
  }

  /**
   * Enable camera
   */
  async enableCamera(deviceId?: string): Promise<void> {
    logger.info('Enabling camera:', { deviceId });

    // Ensure mediasoup adapter is initialized
    if (!this.mediasoupAdapter) {
      await this.initializeMediasoupAdapter();
    }

    // Send enable camera intent
    this.sendIntent({
      type: 'enable_camera',
      deviceId,
    });

    logger.info('Enable camera intent sent');
  }

  /**
   * Disable camera
   */
  async disableCamera(): Promise<void> {
    logger.info('Disabling camera');

    // Send disable camera intent
    this.sendIntent({
      type: 'disable_camera',
    });

    logger.info('Disable camera intent sent');
  }

  /**
   * Enable microphone
   */
  async enableMicrophone(deviceId?: string): Promise<void> {
    logger.info('Enabling microphone:', { deviceId });

    // Ensure mediasoup adapter is initialized
    if (!this.mediasoupAdapter) {
      await this.initializeMediasoupAdapter();
    }

    // Send enable microphone intent
    this.sendIntent({
      type: 'enable_microphone',
      deviceId,
    });

    logger.info('Enable microphone intent sent');
  }

  /**
   * Disable microphone
   */
  async disableMicrophone(): Promise<void> {
    logger.info('Disabling microphone');

    // Send disable microphone intent
    this.sendIntent({
      type: 'disable_microphone',
    });

    logger.info('Disable microphone intent sent');
  }

  /**
   * Send data to all participants
   */
  async sendData(data: unknown, kind: 'reliable' | 'lossy' = 'reliable'): Promise<void> {
    logger.debug('Sending data:', { kind });

    // Send send data intent
    this.sendIntent({
      type: 'send_data',
      payload: data,
      kind,
    });

    logger.debug('Send data intent sent');
  }

  /**
   * Subscribe to participant's tracks
   */
  async subscribeToParticipant(participantSid: string): Promise<void> {
    logger.info('Subscribing to participant:', { participantSid });

    // Send subscribe to participant intent
    this.sendIntent({
      type: 'subscribe_to_participant',
      participantSid,
    });

    logger.info('Subscribe to participant intent sent');
  }

  /**
   * Unsubscribe from participant's tracks
   */
  async unsubscribeFromParticipant(participantSid: string): Promise<void> {
    logger.info('Unsubscribing from participant:', { participantSid });

    // Send unsubscribe from participant intent
    this.sendIntent({
      type: 'unsubscribe_from_participant',
      participantSid,
    });

    logger.info('Unsubscribe from participant intent sent');
  }

  /**
   * Mute track
   */
  async muteTrack(trackSid: string): Promise<void> {
    logger.info('Muting track:', { trackSid });

    // Send mute track intent
    this.sendIntent({
      type: 'mute_track',
      trackSid,
    });

    logger.info('Mute track intent sent');
  }

  /**
   * Unmute track
   */
  async unmuteTrack(trackSid: string): Promise<void> {
    logger.info('Unmuting track:', { trackSid });

    // Send unmute track intent
    this.sendIntent({
      type: 'unmute_track',
      trackSid,
    });

    logger.info('Unmute track intent sent');
  }

  /**
   * Disconnect from the room
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from room...');

    // Close mediasoup adapter
    if (this.mediasoupAdapter) {
      this.mediasoupAdapter.close();
      this.mediasoupAdapter = null;
    }

    // Send leave room intent
    this.sendIntent({
      type: 'leave_room',
    });

    // Disconnect signaling client
    this.signalingClient.disconnect();

    // Clear state
    this.roomInfo = null;
    this.localParticipant = null;
    this.participants.clear();
    this.rtpCapabilities = null;

    logger.info('Disconnected');
  }

  /**
   * Get room info
   */
  getRoomInfo(): RoomInfo | null {
    return this.roomInfo;
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): ParticipantInfo | null {
    return this.localParticipant;
  }

  /**
   * Get all participants
   */
  getParticipants(): ParticipantInfo[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get participant by SID
   */
  getParticipant(sid: string): ParticipantInfo | null {
    return this.participants.get(sid) ?? null;
  }

  /**
   * Get mediasoup adapter (for advanced use cases)
   */
  getMediasoupAdapter(): MediasoupAdapter | null {
    return this.mediasoupAdapter;
  }

  /**
   * Get signaling client (for advanced use cases)
   */
  getSignalingClient(): SignalingClient {
    return this.signalingClient;
  }

  /**
   * Add event listener
   */
  on<K extends keyof RoomEvents>(event: K, listener: RoomEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    (this.eventListeners.get(event) as Set<(data: unknown) => void>).add(
      listener as (data: unknown) => void
    );
  }

  /**
   * Remove event listener
   */
  off<K extends keyof RoomEvents>(event: K, listener: RoomEvents[K]): void {
    (this.eventListeners.get(event) as Set<(data: unknown) => void>)?.delete(
      listener as (data: unknown) => void
    );
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Initialize mediasoup adapter
   */
  private async initializeMediasoupAdapter(): Promise<void> {
    if (this.mediasoupAdapter) {
      return;
    }

    if (!this.rtpCapabilities) {
      throw new Error('RTP capabilities not available. Wait for room joined.');
    }

    logger.info('Initializing mediasoup adapter...');

    this.mediasoupAdapter = new MediasoupAdapterImpl({
      signalingClient: this.signalingClient,
      rtpCapabilities: this.rtpCapabilities,
      onStateChange: (state) => {
        logger.debug('Mediasoup adapter state changed:', { state });
      },
      onError: (error) => {
        logger.error('Mediasoup adapter error:', { error });
        this.emit('error', error);
      },
      onTrackPublished: (producerId, trackSid) => {
        logger.info('Track published:', { producerId, trackSid });
      },
      onTrackUnpublished: (trackSid) => {
        logger.info('Track unpublished:', { trackSid });
      },
      onTrackSubscribed: (consumerId, trackSid) => {
        logger.info('Track subscribed:', { consumerId, trackSid });
      },
      onTrackUnsubscribed: (trackSid) => {
        logger.info('Track unsubscribed:', { trackSid });
      },
    });

    await this.mediasoupAdapter.initialize();

    logger.info('Mediasoup adapter initialized');
  }

  /**
   * Setup signaling client listeners
   */
  private setupSignalingListeners(): void {
    this.signalingClient.onStateChange((state) => {
      logger.debug('Signaling state changed:', { state });
      this.emit('connection-state-changed', state);
    });

    this.signalingClient.onError((error) => {
      logger.error('Signaling error:', { error });
      this.emit('error', error);
    });

    this.signalingClient.onMessage((message) => {
      this.handleServerMessage(message as unknown as ServerResponse);
    });
  }

  /**
   * Handle server message
   */
  private handleServerMessage(message: ServerResponse): void {
    logger.debug('Server message received:', { type: message.type });

    switch (message.type) {
      case 'room_joined':
        this.roomInfo = message.room;
        this.localParticipant = message.participant;
        message.otherParticipants.forEach((participant) => {
          this.participants.set(participant.sid, participant);
        });
        this.emit('room-joined', {
          room: message.room,
          participant: message.participant,
          otherParticipants: message.otherParticipants,
        });
        break;

      case 'participant_joined':
        this.participants.set(message.participant.sid, message.participant);
        this.emit('participant-joined', message.participant);
        break;

      case 'participant_left':
        this.participants.delete(message.participantSid);
        this.emit('participant-left', message.participantSid);
        break;

      case 'call_received':
        this.emit('call-received', {
          callId: message.callId,
          caller: message.caller,
          metadata: message.metadata,
        });
        break;

      case 'call_accepted':
        this.emit('call-accepted', {
          callId: message.callId,
          participant: message.participant,
        });
        break;

      case 'call_rejected':
        this.emit('call-rejected', {
          callId: message.callId,
          participant: message.participant,
          reason: message.reason,
        });
        break;

      case 'call_ended':
        this.emit('call-ended', {
          callId: message.callId,
          reason: message.reason,
        });
        break;

      case 'track_published':
        this.emit('track-published', {
          participantSid: message.participantSid,
          track: message.track,
        });
        break;

      case 'track_unpublished':
        this.emit('track-unpublished', {
          participantSid: message.participantSid,
          trackSid: message.trackSid,
        });
        break;

      case 'track_subscribed':
        this.emit('track-subscribed', {
          participantSid: message.participantSid,
          track: message.track,
        });
        break;

      case 'track_unsubscribed':
        this.emit('track-unsubscribed', {
          participantSid: message.participantSid,
          trackSid: message.trackSid,
        });
        break;

      case 'track_muted':
        this.emit('track-muted', {
          participantSid: message.participantSid,
          trackSid: message.trackSid,
        });
        break;

      case 'track_unmuted':
        this.emit('track-unmuted', {
          participantSid: message.participantSid,
          trackSid: message.trackSid,
        });
        break;

      case 'data_received':
        this.emit('data-received', {
          participantSid: message.participantSid,
          payload: message.payload,
          kind: message.kind,
        });
        break;

      case 'error':
        this.emit('error', new Error(message.error.message));
        break;

      default:
        logger.warn('Unknown message type:', { type: (message as { type: string }).type });
    }
  }

  /**
   * Send intent to server
   */
  private sendIntent(intent: ClientIntent): void {
    this.signalingClient.send(intent as unknown as Record<string, unknown>);
  }

  /**
   * Emit event
   */
  private emit<K extends keyof RoomEvents>(event: K, data: Parameters<RoomEvents[K]>[0]): void {
    (this.eventListeners.get(event) as Set<(data: unknown) => void>)?.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        logger.error('Error in event listener:', { event, error });
      }
    });
  }
}
