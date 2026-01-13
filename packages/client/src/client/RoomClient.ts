/**
 * RoomClient - Public API facade for room operations
 *
 * This is the main entry point for the client SDK. It provides a simple, high-level API
 * for interacting with rooms, calls, and media. Internally, it uses the services layer
 * (RoomService, CallService) to orchestrate operations.
 *
 * This client is stateful and imperative (not React-aware).
 */

import type { SignalingClient, SignalingClientOptions } from '../signaling/SignalingClient';
import { SignalingClient as SignalingClientImpl } from '../signaling/SignalingClient';
import type {
  RoomInfo,
  ParticipantInfo,
  TrackInfo,
  ClientIntent,
  ServerResponse,
} from '@bytepulse/pulsewave-shared';
import { RoomService } from '../services/RoomService';
import { CallService } from '../services/CallService';
import { createModuleLogger, withTimeout } from '../utils';
import { EventEmitter } from '../utils';

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

  /**
   * Timeout for async operations in milliseconds (default: 30000ms)
   */
  timeout?: number;
}

/**
 * Room events
 */
export interface RoomClientEvents {
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

export class RoomClient extends EventEmitter<RoomClientEvents> {
  private signalingClient: SignalingClient<ClientIntent, ServerResponse>;
  private roomService: RoomService;
  private callService: CallService;

  constructor(private readonly options: RoomClientOptions) {
    super({ name: 'RoomClient' });
    // Initialize signaling client
    this.signalingClient = new SignalingClientImpl<ClientIntent, ServerResponse>({
      transport: options.signaling.transport,
      transportImpl: options.signaling.transportImpl,
    });

    // Initialize room service
    this.roomService = new RoomService({
      signalingClient: this.signalingClient,
      createMediaEngineAdapter: async (_rtpCapabilities) => {
        // Media engine adapter will be created by the RoomService
        // This is a placeholder - the actual implementation should be in RoomService
        throw new Error('MediaEngineAdapter creation not implemented');
      },
    });

    // Initialize call service
    this.callService = new CallService({
      roomService: this.roomService,
    });

    // Setup service listeners
    this.setupServiceListeners();
  }

  /**
   * Connect to the room (presence-only, no media)
   */
  async connect(): Promise<void> {
    logger.info('Connecting to room...');
    const timeout = this.options.timeout ?? 30000;

    await withTimeout(
      this.roomService.connect(this.options.room, this.options.token, this.options.metadata),
      { timeout, message: 'Failed to connect to room' }
    );
  }

  /**
   * Start a call (initiate media session)
   */
  async startCall(targetUserId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Starting call:', { targetUserId });
    await this.callService.startCall(targetUserId, metadata);
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Accepting call:', { callId });
    await this.callService.acceptCall(callId, metadata);
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string, reason?: string): Promise<void> {
    logger.info('Rejecting call:', { callId, reason });
    await this.callService.rejectCall(callId, reason);
  }

  /**
   * End a call
   */
  async endCall(callId: string, reason?: string): Promise<void> {
    logger.info('Ending call:', { callId, reason });
    await this.callService.endCall(callId, reason);
  }

  /**
   * Enable camera
   */
  async enableCamera(deviceId?: string): Promise<void> {
    logger.info('Enabling camera:', { deviceId });
    this.roomService.sendIntent({
      type: 'enable_camera',
      deviceId,
    });
  }

  async disableCamera(): Promise<void> {
    logger.info('Disabling camera');
    this.roomService.sendIntent({
      type: 'disable_camera',
    });
  }

  async enableMicrophone(deviceId?: string): Promise<void> {
    logger.info('Enabling microphone:', { deviceId });
    this.roomService.sendIntent({
      type: 'enable_microphone',
      deviceId,
    });
  }

  async disableMicrophone(): Promise<void> {
    logger.info('Disabling microphone');
    this.roomService.sendIntent({
      type: 'disable_microphone',
    });
  }

  /**
   * Send data to all participants
   */
  async sendData(data: unknown, kind: 'reliable' | 'lossy' = 'reliable'): Promise<void> {
    logger.debug('Sending data:', { kind });
    this.roomService.sendIntent({
      type: 'send_data',
      payload: data,
      kind,
    });
  }

  async subscribeToParticipant(participantSid: string): Promise<void> {
    logger.info('Subscribing to participant:', { participantSid });
    this.roomService.sendIntent({
      type: 'subscribe_to_participant',
      participantSid,
    });
  }

  async unsubscribeFromParticipant(participantSid: string): Promise<void> {
    logger.info('Unsubscribing from participant:', { participantSid });
    this.roomService.sendIntent({
      type: 'unsubscribe_from_participant',
      participantSid,
    });
  }

  async muteTrack(trackSid: string): Promise<void> {
    logger.info('Muting track:', { trackSid });
    this.roomService.sendIntent({
      type: 'mute_track',
      trackSid,
    });
  }

  async unmuteTrack(trackSid: string): Promise<void> {
    logger.info('Unmuting track:', { trackSid });
    this.roomService.sendIntent({
      type: 'unmute_track',
      trackSid,
    });
  }

  /**
   * Disconnect from the room
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from room...');
    await this.roomService.disconnect();
  }

  /**
   * Get room info
   */
  getRoomInfo(): RoomInfo | null {
    return this.roomService.getRoomInfo();
  }

  getLocalParticipant(): ParticipantInfo | null {
    return this.roomService.getLocalParticipantInfo();
  }

  getParticipants(): ParticipantInfo[] {
    return this.roomService.getParticipants();
  }

  getParticipant(sid: string): ParticipantInfo | null {
    return this.roomService.getParticipant(sid);
  }

  getMediaEngineAdapter() {
    // For advanced use cases - return the adapter from room service
    return this.roomService.getOrCreateMediaEngineAdapter().catch(() => null);
  }

  getSignalingClient(): SignalingClient<ClientIntent, ServerResponse> {
    return this.signalingClient;
  }

  /**
   * Setup service listeners
   */
  private setupServiceListeners(): void {
    // Forward room service events
    this.roomService.on('connection-state-changed', (state) => {
      this.emit('connection-state-changed', state);
    });

    this.roomService.on('room-joined', (data) => {
      this.emit('room-joined', data);
    });

    this.roomService.on('participant-joined', (participant) => {
      this.emit('participant-joined', participant);
    });

    this.roomService.on('participant-left', (participantSid) => {
      this.emit('participant-left', participantSid);
    });

    this.roomService.on('error', (error) => {
      this.emit('error', error);
    });

    // Forward call service events
    this.callService.on('call-received', (data) => {
      this.emit('call-received', data);
    });

    this.callService.on('call-accepted', (data) => {
      this.emit('call-accepted', data);
    });

    this.callService.on('call-rejected', (data) => {
      this.emit('call-rejected', data);
    });

    this.callService.on('call-ended', (data) => {
      this.emit('call-ended', data);
    });

    this.callService.on('error', (error) => {
      this.emit('error', error);
    });
  }
}
