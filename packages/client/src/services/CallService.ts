/**
 * CallService - Orchestrates call-level operations
 *
 * This service manages call state, call operations (start, accept, reject, end),
 * and coordinates between signaling and media adapter.
 */

import type { RoomService } from './RoomService';
import type { ServerResponse, ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('call-service');

/**
 * Call service events
 */
export interface CallServiceEvents {
  /**
   * Call received (incoming call)
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
   * Error
   */
  error: (error: Error) => void;
}

/**
 * Call service options
 */
export interface CallServiceOptions {
  /**
   * Room service
   */
  roomService: RoomService;
}

/**
 * CallService - Orchestrates call-level operations
 */
export class CallService {
  private activeCallId: string | null = null;
  private eventListeners: Map<
    keyof CallServiceEvents,
    Set<CallServiceEvents[keyof CallServiceEvents]>
  > = new Map();

  constructor(private readonly options: CallServiceOptions) {
    this.setupRoomServiceListeners();
  }

  /**
   * Start a call (initiate media session)
   */
  async startCall(targetUserId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Starting call:', { targetUserId });

    // Ensure media engine adapter is initialized
    await this.options.roomService.getOrCreateMediaEngineAdapter();

    // Send start call intent
    this.options.roomService.sendIntent({
      type: 'start_call',
      targetUserId,
      metadata,
    });

    logger.info('Start call intent sent');
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Accepting call:', { callId });

    // Ensure media engine adapter is initialized
    await this.options.roomService.getOrCreateMediaEngineAdapter();

    // Send accept call intent
    this.options.roomService.sendIntent({
      type: 'accept_call',
      callId,
      metadata,
    });

    // Track active call
    this.activeCallId = callId;

    logger.info('Accept call intent sent');
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string, reason?: string): Promise<void> {
    logger.info('Rejecting call:', { callId, reason });

    // Send reject call intent
    this.options.roomService.sendIntent({
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
    this.options.roomService.sendIntent({
      type: 'end_call',
      callId,
      reason,
    });

    // Clear active call
    if (this.activeCallId === callId) {
      this.activeCallId = null;
    }

    logger.info('End call intent sent');
  }

  /**
   * Get active call ID
   */
  getActiveCallId(): string | null {
    return this.activeCallId;
  }

  /**
   * Add event listener
   */
  on<K extends keyof CallServiceEvents>(event: K, listener: CallServiceEvents[K]): void {
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
  off<K extends keyof CallServiceEvents>(event: K, listener: CallServiceEvents[K]): void {
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
   * Setup room service listeners
   */
  private setupRoomServiceListeners(): void {
    // Listen to room service events and forward call-related events
    this.options.roomService.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Handle server message (called by RoomClient)
   */
  handleServerMessage(message: ServerResponse): void {
    logger.debug('Server message received:', { type: message.type });

    switch (message.type) {
      case 'call_received':
        this.handleCallReceived(message);
        break;

      case 'call_accepted':
        this.handleCallAccepted(message);
        break;

      case 'call_rejected':
        this.handleCallRejected(message);
        break;

      case 'call_ended':
        this.handleCallEnded(message);
        break;
    }
  }

  /**
   * Handle call received
   */
  private handleCallReceived(message: {
    callId: string;
    caller: ParticipantInfo;
    metadata?: Record<string, unknown>;
  }): void {
    this.emit('call-received', {
      callId: message.callId,
      caller: message.caller,
      metadata: message.metadata,
    });
  }

  /**
   * Handle call accepted
   */
  private handleCallAccepted(message: { callId: string; participant: ParticipantInfo }): void {
    this.activeCallId = message.callId;
    this.emit('call-accepted', {
      callId: message.callId,
      participant: message.participant,
    });
  }

  /**
   * Handle call rejected
   */
  private handleCallRejected(message: {
    callId: string;
    participant: ParticipantInfo;
    reason?: string;
  }): void {
    this.emit('call-rejected', {
      callId: message.callId,
      participant: message.participant,
      reason: message.reason,
    });
  }

  /**
   * Handle call ended
   */
  private handleCallEnded(message: { callId: string; reason?: string }): void {
    if (this.activeCallId === message.callId) {
      this.activeCallId = null;
    }
    this.emit('call-ended', {
      callId: message.callId,
      reason: message.reason,
    });
  }

  /**
   * Emit event
   */
  private emit<K extends keyof CallServiceEvents>(
    event: K,
    data: Parameters<CallServiceEvents[K]>[0]
  ): void {
    (this.eventListeners.get(event) as Set<(data: unknown) => void>)?.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        logger.error('Error in event listener:', { event, error });
      }
    });
  }
}
