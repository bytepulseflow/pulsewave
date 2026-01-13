/**
 * RoomService - Orchestrates room-level operations
 *
 * This service manages room state, participant management, and room-level operations.
 * It coordinates between signaling, media adapter, and domain objects.
 */

import type { SignalingClient } from '../signaling/SignalingClient';
import type { MediaEngineAdapter } from '../adapter/MediaEngineAdapter';
import type { RtpCapabilities } from '@bytepulse/pulsewave-shared';
import type {
  ClientIntent,
  ServerResponse,
  RoomInfo,
  ParticipantInfo,
} from '@bytepulse/pulsewave-shared';
import type { LocalParticipantImpl } from '../domain/LocalParticipant';
import type { RemoteParticipantImpl } from '../domain/Participant';
import { createModuleLogger, EventEmitter } from '../utils';

const logger = createModuleLogger('room-service');

/**
 * Room service events
 */
export interface RoomServiceEvents {
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
   * Error
   */
  error: (error: Error) => void;
}

/**
 * Room service options
 */
export interface RoomServiceOptions {
  /**
   * Signaling client
   */
  signalingClient: SignalingClient<ClientIntent, ServerResponse>;

  /**
   * Media engine adapter factory
   */
  createMediaEngineAdapter: (rtpCapabilities: RtpCapabilities) => Promise<MediaEngineAdapter>;
}

/**
 * RoomService - Orchestrates room-level operations
 */
export class RoomService extends EventEmitter<RoomServiceEvents> {
  private roomInfo: RoomInfo | null = null;
  private localParticipant: ParticipantInfo | null = null;
  private participants: Map<string, ParticipantInfo> = new Map();
  private mediaEngineAdapter: MediaEngineAdapter | null = null;
  private localParticipantImpl: LocalParticipantImpl | null = null;
  private remoteParticipants: Map<string, RemoteParticipantImpl> = new Map();

  constructor(private readonly options: RoomServiceOptions) {
    super({ name: 'RoomService' });
    this.setupSignalingListeners();
  }

  /**
   * Connect to the room (presence-only, no media)
   */
  async connect(room: string, token: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Connecting to room...', { room });

    try {
      await this.options.signalingClient.connect();

      // Send join room intent
      this.sendIntent({
        type: 'join_room',
        room,
        token,
        metadata,
      });

      logger.info('Join room intent sent');
    } catch (error) {
      logger.error('Failed to connect:', { error });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from the room
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from room...');

    // Close media engine adapter
    if (this.mediaEngineAdapter) {
      this.mediaEngineAdapter.close();
      this.mediaEngineAdapter = null;
    }

    // Clear domain objects
    if (this.localParticipantImpl) {
      this.localParticipantImpl.removeAllListeners();
      this.localParticipantImpl = null;
    }

    this.remoteParticipants.forEach((participant) => {
      participant.removeAllListeners();
    });
    this.remoteParticipants.clear();

    // Send leave room intent
    this.sendIntent({
      type: 'leave_room',
    });

    // Disconnect signaling client
    this.options.signalingClient.disconnect();

    // Clear state
    this.roomInfo = null;
    this.localParticipant = null;
    this.participants.clear();

    logger.info('Disconnected');
  }

  /**
   * Get room info
   */
  getRoomInfo(): RoomInfo | null {
    return this.roomInfo;
  }

  /**
   * Get local participant info
   */
  getLocalParticipantInfo(): ParticipantInfo | null {
    return this.localParticipant;
  }

  /**
   * Get local participant implementation
   */
  getLocalParticipantImpl(): LocalParticipantImpl | null {
    return this.localParticipantImpl;
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
   * Get remote participant implementation by SID
   */
  getRemoteParticipantImpl(sid: string): RemoteParticipantImpl | null {
    return this.remoteParticipants.get(sid) ?? null;
  }

  /**
   * Get or create media engine adapter
   */
  async getOrCreateMediaEngineAdapter(): Promise<MediaEngineAdapter> {
    if (!this.mediaEngineAdapter) {
      // Get RTP capabilities from browser
      const device = new (await import('mediasoup-client')).Device();
      const rtpCapabilities = device.rtpCapabilities;
      this.mediaEngineAdapter = await this.options.createMediaEngineAdapter(rtpCapabilities);
    }
    return this.mediaEngineAdapter;
  }

  /**
   * Setup signaling client listeners
   */
  private setupSignalingListeners(): void {
    this.options.signalingClient.onStateChange((state) => {
      logger.debug('Signaling state changed:', { state });
      this.emit('connection-state-changed', state);
    });

    this.options.signalingClient.onError((error) => {
      logger.error('Signaling error:', { error });
      this.emit('error', error);
    });

    this.options.signalingClient.onMessage((message) => {
      this.handleServerMessage(message);
    });
  }

  /**
   * Handle server message
   */
  private handleServerMessage(message: ServerResponse): void {
    logger.debug('Server message received:', { type: message.type });

    switch (message.type) {
      case 'room_joined':
        this.handleRoomJoined(message);
        break;

      case 'participant_joined':
        this.handleParticipantJoined(message);
        break;

      case 'participant_left':
        this.handleParticipantLeft(message);
        break;

      case 'error':
        this.emit('error', new Error(message.error.message));
        break;

      case 'call_started':
      case 'call_received':
      case 'call_accepted':
      case 'call_rejected':
      case 'call_ended':
      case 'camera_enabled':
      case 'camera_disabled':
      case 'microphone_enabled':
      case 'microphone_disabled':
      case 'data_received':
      case 'track_published':
      case 'track_unpublished':
      case 'track_subscribed':
      case 'track_unsubscribed':
      case 'track_muted':
      case 'track_unmuted':
        // These message types are handled by other services (CallService, TrackService, etc.)
        logger.debug('Message handled by another service:', { type: message.type });
        break;

      default: {
        // Type guard to ensure we've covered all cases
        const unhandled: never = message;
        logger.warn('Unhandled server message type:', {
          type: (unhandled as { type: string }).type,
        });
        break;
      }
    }
  }

  /**
   * Handle room joined
   */
  private handleRoomJoined(message: {
    room: RoomInfo;
    participant: ParticipantInfo;
    otherParticipants: ParticipantInfo[];
  }): void {
    this.roomInfo = message.room;
    this.localParticipant = message.participant;
    // RTP capabilities will be obtained when needed through the mediasoup adapter

    message.otherParticipants.forEach((participant) => {
      this.participants.set(participant.sid, participant);
    });

    this.emit('room-joined', {
      room: message.room,
      participant: message.participant,
      otherParticipants: message.otherParticipants,
    });
  }

  /**
   * Handle participant joined
   */
  private handleParticipantJoined(message: { participant: ParticipantInfo }): void {
    this.participants.set(message.participant.sid, message.participant);
    this.emit('participant-joined', message.participant);
  }

  /**
   * Handle participant left
   */
  private handleParticipantLeft(message: { participantSid: string }): void {
    this.participants.delete(message.participantSid);
    const remoteParticipant = this.remoteParticipants.get(message.participantSid);
    if (remoteParticipant) {
      remoteParticipant.removeAllListeners();
      this.remoteParticipants.delete(message.participantSid);
    }
    this.emit('participant-left', message.participantSid);
  }

  /**
   * Send intent to server
   */
  sendIntent(intent: ClientIntent): void {
    this.options.signalingClient.send(intent);
  }
}
