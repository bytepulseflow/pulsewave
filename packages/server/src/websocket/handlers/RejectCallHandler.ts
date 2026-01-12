/**
 * Reject call message handler
 */

import { CLIENT_EVENTS, ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RejectCallMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:reject-call');

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
    const call = room.getCall(callId);
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
    if (call.state !== 'pending') {
      this.sendError(context.ws, ErrorCode.InvalidCallState, 'Call is not in pending state');
      return;
    }

    // Update call state to rejected
    room.updateCall(callId, { state: 'rejected', endTime: Date.now() });

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
}
