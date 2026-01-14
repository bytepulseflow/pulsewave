/**
 * CallManager - Application Layer for call management
 *
 * This is the business logic layer for call management.
 * It is independent of mediasoup and WebRTC details.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ApplicationCall, CallManagerOptions, CallResult, CallInfo } from './types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('application:call-manager');

/**
 * Application Call implementation
 */
class ApplicationCallImpl implements ApplicationCall {
  public readonly callId: string;
  public readonly callerSid: string;
  public readonly targetSid: string;
  public readonly startTime: number;
  private _state: 'pending' | 'accepted' | 'rejected' | 'ended';
  private _endTime?: number;
  public metadata?: Record<string, unknown>;

  constructor(callerSid: string, targetSid: string, metadata?: Record<string, unknown>) {
    this.callId = uuidv4();
    this.callerSid = callerSid;
    this.targetSid = targetSid;
    this.startTime = Date.now();
    this._state = 'pending';
    this.metadata = metadata;
  }

  get state(): 'pending' | 'accepted' | 'rejected' | 'ended' {
    return this._state;
  }

  get endTime(): number | undefined {
    return this._endTime;
  }

  public getInfo(): CallInfo {
    return {
      callId: this.callId,
      callerSid: this.callerSid,
      targetSid: this.targetSid,
      state: this._state,
      startTime: this.startTime,
      endTime: this._endTime,
      metadata: this.metadata,
    };
  }

  public setState(state: 'pending' | 'accepted' | 'rejected' | 'ended'): void {
    this._state = state;
    if (state === 'ended' && !this._endTime) {
      this._endTime = Date.now();
    }
  }

  public end(reason?: string): void {
    this._state = 'ended';
    this._endTime = Date.now();
    if (reason) {
      this.metadata = { ...this.metadata, endReason: reason };
    }
  }
}

/**
 * Application Call Manager
 */
export class CallManager {
  private calls: Map<string, ApplicationCall>;
  private activeCallsByParticipant: Map<string, string>; // participantSid -> callId
  private callsBetweenParticipants: Map<string, string>; // "sid1-sid2" -> callId
  private cleanupInterval: NodeJS.Timeout | null;
  private options: CallManagerOptions;

  constructor(options: CallManagerOptions = {}) {
    this.calls = new Map();
    this.activeCallsByParticipant = new Map();
    this.callsBetweenParticipants = new Map();
    this.cleanupInterval = null;
    this.options = options;

    // Start automatic cleanup if enabled
    if (options.enableAutoCleanup !== false) {
      this.startAutoCleanup();
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    const cleanupIntervalMs = this.options.cleanupIntervalMs || 60 * 60 * 1000; // Default: 1 hour

    this.cleanupInterval = setInterval(() => {
      const before = this.calls.size;
      this.cleanupOldCalls(this.options.cleanupMaxAge || 60 * 60 * 1000); // Default: 1 hour
      const after = this.calls.size;
      const cleaned = before - after;

      if (cleaned > 0) {
        logger.info(`Auto-cleanup removed ${cleaned} old calls`);
      }
    }, cleanupIntervalMs);

    logger.info(`Auto-cleanup started (interval: ${cleanupIntervalMs}ms)`);
  }

  /**
   * Stop automatic cleanup interval
   */
  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Auto-cleanup stopped');
    }
  }

  /**
   * Shutdown the CallManager and cleanup resources
   */
  public shutdown(): void {
    this.stopAutoCleanup();
    this.clearAllCalls();
    logger.info('CallManager shutdown complete');
  }

  /**
   * Generate a key for calls between participants (sorted)
   */
  private getParticipantPairKey(sid1: string, sid2: string): string {
    return [sid1, sid2].sort().join('-');
  }

  /**
   * Start a new call
   */
  public startCall(
    callerSid: string,
    targetSid: string,
    metadata?: Record<string, unknown>
  ): CallResult {
    // Check if caller and target are different
    if (callerSid === targetSid) {
      return {
        success: false,
        error: 'Cannot call yourself',
      };
    }

    // Check if there's already an active call between these participants
    const existingCall = this.getCallBetweenParticipants(callerSid, targetSid);
    if (existingCall && existingCall.state !== 'ended' && existingCall.state !== 'rejected') {
      return {
        success: false,
        error: 'There is already an active call between these participants',
      };
    }

    // Check if caller or target already has an active call (if multiple calls are not allowed)
    if (!this.options.allowMultipleCalls) {
      const callerActiveCall = this.getActiveCallForParticipant(callerSid);
      if (callerActiveCall) {
        return {
          success: false,
          error: 'Caller already has an active call',
        };
      }

      const targetActiveCall = this.getActiveCallForParticipant(targetSid);
      if (targetActiveCall) {
        return {
          success: false,
          error: 'Target already has an active call',
        };
      }
    }

    const call = new ApplicationCallImpl(callerSid, targetSid, metadata);
    this.calls.set(call.callId, call);

    // Index active calls by participant
    this.activeCallsByParticipant.set(callerSid, call.callId);
    this.activeCallsByParticipant.set(targetSid, call.callId);

    // Index calls between participants
    const pairKey = this.getParticipantPairKey(callerSid, targetSid);
    this.callsBetweenParticipants.set(pairKey, call.callId);

    logger.info(`Call started: ${call.callId} from ${callerSid} to ${targetSid}`);

    return {
      success: true,
      call,
    };
  }

  /**
   * Accept a call
   */
  public acceptCall(callId: string): CallResult {
    const call = this.calls.get(callId);
    if (!call) {
      return {
        success: false,
        error: 'Call not found',
      };
    }

    if (call.state !== 'pending') {
      return {
        success: false,
        error: `Call is not in pending state (current state: ${call.state})`,
      };
    }

    call.setState('accepted');

    // Update active call index (already indexed, just confirming it's active)
    this.activeCallsByParticipant.set(call.callerSid, callId);
    this.activeCallsByParticipant.set(call.targetSid, callId);

    logger.info(`Call accepted: ${callId}`);

    return {
      success: true,
      call,
    };
  }

  /**
   * Reject a call
   */
  public rejectCall(callId: string, reason?: string): CallResult {
    const call = this.calls.get(callId);
    if (!call) {
      return {
        success: false,
        error: 'Call not found',
      };
    }

    if (call.state !== 'pending') {
      return {
        success: false,
        error: `Call is not in pending state (current state: ${call.state})`,
      };
    }

    call.setState('rejected');
    call.end(reason);

    // Remove from active call index
    this.activeCallsByParticipant.delete(call.callerSid);
    this.activeCallsByParticipant.delete(call.targetSid);

    logger.info(`Call rejected: ${callId} (${reason || 'no reason'})`);

    return {
      success: true,
      call,
    };
  }

  /**
   * End a call
   */
  public endCall(callId: string, reason?: string): CallResult {
    const call = this.calls.get(callId);
    if (!call) {
      return {
        success: false,
        error: 'Call not found',
      };
    }

    if (call.state === 'ended') {
      return {
        success: false,
        error: 'Call is already ended',
      };
    }

    call.end(reason);

    // Remove from indexes
    this.activeCallsByParticipant.delete(call.callerSid);
    this.activeCallsByParticipant.delete(call.targetSid);
    const pairKey = this.getParticipantPairKey(call.callerSid, call.targetSid);
    this.callsBetweenParticipants.delete(pairKey);

    logger.info(`Call ended: ${callId} (${reason || 'no reason'})`);

    return {
      success: true,
      call,
    };
  }

  /**
   * Get a call by ID
   */
  public getCall(callId: string): ApplicationCall | undefined {
    return this.calls.get(callId);
  }

  /**
   * Get all calls
   */
  public getCalls(): ApplicationCall[] {
    return Array.from(this.calls.values());
  }

  /**
   * Get active calls (not ended)
   */
  public getActiveCalls(): ApplicationCall[] {
    return Array.from(this.calls.values()).filter(
      (call) => call.state !== 'ended' && call.state !== 'rejected'
    );
  }

  /**
   * Get calls for a participant
   */
  public getCallsForParticipant(participantSid: string): ApplicationCall[] {
    return Array.from(this.calls.values()).filter(
      (call) => call.callerSid === participantSid || call.targetSid === participantSid
    );
  }

  /**
   * Get active call for a participant
   */
  public getActiveCallForParticipant(participantSid: string): ApplicationCall | undefined {
    const callId = this.activeCallsByParticipant.get(participantSid);
    return callId ? this.calls.get(callId) : undefined;
  }

  /**
   * Get call between two participants (O(1) lookup)
   */
  public getCallBetweenParticipants(sid1: string, sid2: string): ApplicationCall | undefined {
    const pairKey = this.getParticipantPairKey(sid1, sid2);
    const callId = this.callsBetweenParticipants.get(pairKey);
    return callId ? this.calls.get(callId) : undefined;
  }

  /**
   * Get pending calls for a participant
   */
  public getPendingCallsForParticipant(participantSid: string): ApplicationCall[] {
    return Array.from(this.calls.values()).filter(
      (call) => call.targetSid === participantSid && call.state === 'pending'
    );
  }

  /**
   * Clean up old calls (ended calls older than specified time)
   */
  public cleanupOldCalls(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [callId, call] of this.calls.entries()) {
      if (call.state === 'ended' || call.state === 'rejected') {
        const age = now - (call.endTime || call.startTime);
        if (age > maxAge) {
          toDelete.push(callId);
        }
      }
    }

    for (const callId of toDelete) {
      this.calls.delete(callId);
    }

    if (toDelete.length > 0) {
      logger.info(`Cleaned up ${toDelete.length} old calls`);
    }
  }

  /**
   * Clear all calls
   */
  public clearAllCalls(): void {
    this.calls.clear();
    this.activeCallsByParticipant.clear();
    this.callsBetweenParticipants.clear();
    logger.info('Cleared all calls');
  }

  /**
   * Get cleanup statistics
   */
  public getCleanupStats(): {
    totalCalls: number;
    endedCalls: number;
    rejectedCalls: number;
    activeCalls: number;
  } {
    let endedCalls = 0;
    let rejectedCalls = 0;
    let activeCalls = 0;

    for (const call of this.calls.values()) {
      if (call.state === 'ended') {
        endedCalls++;
      } else if (call.state === 'rejected') {
        rejectedCalls++;
      } else {
        activeCalls++;
      }
    }

    return {
      totalCalls: this.calls.size,
      endedCalls,
      rejectedCalls,
      activeCalls,
    };
  }
}
