/**
 * Accept call message handler
 */

import { CLIENT_EVENTS, ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { AcceptCallMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:accept-call');

export class AcceptCallHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.ACCEPT_CALL;

  public async handle(context: HandlerContext, message: AcceptCallMessage): Promise<void> {
    const { callId, metadata } = message;

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
      this.sendError(context.ws, ErrorCode.Unauthorized, 'Not authorized to accept this call');
      return;
    }

    // Validate call state
    if (call.state !== 'pending') {
      this.sendError(context.ws, ErrorCode.InvalidCallState, 'Call is not in pending state');
      return;
    }

    // Update call state
    room.updateCall(callId, { state: 'accepted' });

    // Get caller's WebSocket connection
    const caller = room.getParticipant(call.callerSid);
    if (!caller) {
      this.sendError(context.ws, ErrorCode.ParticipantNotFound, 'Caller not found');
      room.updateCall(callId, { state: 'ended', endTime: Date.now() });
      return;
    }

    const callerWs = context.connections.get(caller.socketId);
    if (!callerWs) {
      this.sendError(context.ws, ErrorCode.ParticipantNotFound, 'Caller not connected');
      room.updateCall(callId, { state: 'ended', endTime: Date.now() });
      return;
    }

    // Send call accepted message to caller
    this.send(callerWs, {
      type: 'call_accepted',
      callId,
      participant: participant.getInfo(),
      metadata,
    });

    logger.info(`Call accepted: ${caller.identity} <- ${participant.identity} (callId: ${callId})`);
  }
}
