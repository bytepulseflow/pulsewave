/**
 * Reject call message handler
 */

import { CLIENT_EVENTS, ErrorCode, CallState } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RejectCallMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:reject-call');

/**
 * Call info stored in room
 */
interface RoomCallInfo {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: CallState;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

export class RejectCallHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.REJECT_CALL;

  public async handle(context: HandlerContext, message: RejectCallMessage): Promise<void> {
    const { callId, reason } = message;

    // Validate participant is in a room
    if (!this.validateParticipant(context)) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Not in a room');
      return;
    }

    const room = this.getRoom(context);
    const participant = this.getParticipant(context);

    if (!room || !participant) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Invalid room or participant');
      return;
    }

    // Find the call
    const call = this.getCallById(room, callId);
    if (!call) {
      this.sendError(context.ws, ErrorCode.CallNotFound, 'Call not found');
      return;
    }

    // Validate that this participant is the target of the call
    if (call.targetSid !== participant.sid) {
      this.sendError(context.ws, ErrorCode.Unauthorized, 'Not authorized to reject this call');
      return;
    }

    // Validate call state
    if (call.state !== CallState.Pending) {
      this.sendError(context.ws, ErrorCode.InvalidCallState, 'Call is not in pending state');
      return;
    }

    // Update call state to ended
    this.updateCallStateInRoom(room, callId, CallState.Rejected);

    // Get caller's WebSocket connection
    const caller = room.getParticipant(call.callerSid);
    if (!caller) {
      logger.warn(`Caller not found for call ${callId}`);
      return;
    }

    const callerWs = context.connections.get(caller.socketId);
    if (!callerWs) {
      logger.warn(`Caller not connected for call ${callId}`);
      return;
    }

    // Send call rejected message to caller
    this.send(callerWs, {
      type: 'call_rejected',
      callId,
      participant: participant.getInfo(),
      reason,
    });

    logger.info(
      `Call rejected: ${caller.identity} <- ${participant.identity} (callId: ${callId}, reason: ${reason || 'No reason provided'})`
    );
  }

  /**
   * Get call by ID
   */
  private getCallById(room: any, callId: string): RoomCallInfo | null {
    const calls = this.getCallsFromRoom(room);
    return calls.find((call) => call.callId === callId) || null;
  }

  /**
   * Get all calls from room
   */
  private getCallsFromRoom(room: any): RoomCallInfo[] {
    return (room.metadata?.calls as RoomCallInfo[]) || [];
  }

  /**
   * Update call state in room metadata
   */
  private updateCallStateInRoom(room: any, callId: string, state: CallState): void {
    const calls = this.getCallsFromRoom(room);
    const call = calls.find((c) => c.callId === callId);
    if (call) {
      call.state = state;
      if (state === CallState.Ended || state === CallState.Rejected) {
        call.endTime = Date.now();
      }
      room.metadata = { ...room.metadata, calls };
    }
  }
}
