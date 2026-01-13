/**
 * Reject call intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { RejectCallIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:reject-call');

export class RejectCallHandler extends BaseHandler {
  public readonly type = 'reject_call';

  public async handle(context: HandlerContext, message: RejectCallIntent): Promise<void> {
    const appParticipant = this.getApplicationParticipant(context);

    if (!appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Participant not found');
      return;
    }

    // Reject call using CallManager
    const result = context.callManager.rejectCall(message.callId, message.reason);

    if (!result.success || !result.call) {
      this.sendError(context.ws, ErrorCode.NotFound, result.error || 'Call not found');
      return;
    }

    const call = result.call;

    // Send call_rejected to the participant
    this.send(context.ws, {
      type: 'call_rejected',
      callId: call.callId,
      participant: appParticipant.getInfo(),
      reason: message.reason,
    });

    // Notify the caller
    const caller = context.applicationRoomManager.getParticipant(call.callerSid);
    if (caller) {
      const callerWs = context.connections.get(caller.socketId);
      if (callerWs) {
        this.send(callerWs, {
          type: 'call_rejected',
          callId: call.callId,
          participant: appParticipant.getInfo(),
          reason: message.reason,
        });
      }
    }

    logger.info(`Call ${call.callId} rejected by ${appParticipant.identity}`);
  }
}
