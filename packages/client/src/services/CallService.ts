/**
 * CallService - Orchestrates call-level operations
 *
 * This service manages call state, call operations (start, accept, reject, end),
 * and coordinates between signaling and media adapter.
 */

import type { RoomService } from './RoomService';
import type { ServerResponse, ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { createModuleLogger, EventEmitter, classifyError, ErrorType } from '../utils';
import { getGlobalTelemetry, TelemetryEventType } from '../telemetry';

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
export class CallService extends EventEmitter<CallServiceEvents> {
  private activeCallId: string | null = null;
  private telemetry = getGlobalTelemetry();

  constructor(private readonly options: CallServiceOptions) {
    super({ name: 'CallService' });
    this.setupRoomServiceListeners();
  }

  /**
   * Start a call (initiate media session)
   */
  async startCall(targetUserId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Starting call:', { targetUserId });
    this.telemetry.info(TelemetryEventType.CALL_STARTED, { targetUserId });

    try {
      // Ensure media engine adapter is initialized
      await this.options.roomService.getOrCreateMediaEngineAdapter();

      // Send start call intent
      this.options.roomService.sendIntent({
        type: 'start_call',
        targetUserId,
        metadata,
      });

      logger.info('Start call intent sent');
    } catch (error) {
      const err = error as Error;
      const errorType = classifyError(err);

      if (errorType === ErrorType.FATAL) {
        logger.error('Fatal error starting call:', { error: err, errorType });
      } else {
        logger.warn('Error starting call:', { error: err, errorType });
      }

      this.emit('error', err);
      this.telemetry.error(TelemetryEventType.CALL_ERROR, err, { targetUserId, errorType });
      throw err;
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.info('Accepting call:', { callId });
    this.telemetry.info(TelemetryEventType.CALL_ACCEPTED, { callId });

    try {
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
    } catch (error) {
      const err = error as Error;
      const errorType = classifyError(err);

      if (errorType === ErrorType.FATAL) {
        logger.error('Fatal error accepting call:', { error: err, errorType });
      } else {
        logger.warn('Error accepting call:', { error: err, errorType });
      }

      this.emit('error', err);
      this.telemetry.error(TelemetryEventType.CALL_ERROR, err, { callId, errorType });
      throw err;
    }
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId: string, reason?: string): Promise<void> {
    logger.info('Rejecting call:', { callId, reason });
    this.telemetry.info(TelemetryEventType.CALL_REJECTED, { callId, reason });

    try {
      // Send reject call intent
      this.options.roomService.sendIntent({
        type: 'reject_call',
        callId,
        reason,
      });

      logger.info('Reject call intent sent');
    } catch (error) {
      const err = error as Error;
      const errorType = classifyError(err);

      if (errorType === ErrorType.FATAL) {
        logger.error('Fatal error rejecting call:', { error: err, errorType });
      } else {
        logger.warn('Error rejecting call:', { error: err, errorType });
      }

      this.emit('error', err);
      this.telemetry.error(TelemetryEventType.CALL_ERROR, err, { callId, errorType });
      throw err;
    }
  }

  /**
   * End a call
   */
  async endCall(callId: string, reason?: string): Promise<void> {
    logger.info('Ending call:', { callId, reason });
    this.telemetry.info(TelemetryEventType.CALL_ENDED, { callId, reason });

    try {
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
    } catch (error) {
      const err = error as Error;
      const errorType = classifyError(err);

      if (errorType === ErrorType.FATAL) {
        logger.error('Fatal error ending call:', { error: err, errorType });
      } else {
        logger.warn('Error ending call:', { error: err, errorType });
      }

      this.emit('error', err);
      this.telemetry.error(TelemetryEventType.CALL_ERROR, err, { callId, errorType });
      throw err;
    }
  }

  /**
   * Get active call ID
   */
  getActiveCallId(): string | null {
    return this.activeCallId;
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
}
