/**
 * End call intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { EndCallIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:end-call');

export class EndCallHandler extends BaseHandler {
  public readonly type = 'end_call';

  public async handle(context: HandlerContext, message: EndCallIntent): Promise<void> {
    const appParticipant = this.getApplicationParticipant(context);

    if (!appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Participant not found');
      return;
    }

    // End call using CallManager
    const result = context.callManager.endCall(message.callId, message.reason);

    if (!result.success || !result.call) {
      this.sendError(context.ws, ErrorCode.NotFound, result.error || 'Call not found');
      return;
    }

    const call = result.call;

    // Send call_ended to the participant
    this.send(context.ws, {
      type: 'call_ended',
      callId: call.callId,
      reason: message.reason,
    });

    // Notify the other participant
    const otherParticipantSid =
      call.callerSid === appParticipant.sid ? call.targetSid : call.callerSid;
    const otherParticipant = context.applicationRoomManager.getParticipant(otherParticipantSid);
    if (otherParticipant) {
      const otherWs = context.connections.get(otherParticipant.socketId);
      if (otherWs) {
        this.send(otherWs, {
          type: 'call_ended',
          callId: call.callId,
          reason: message.reason,
        });
      }
    }

    logger.info(`Call ${call.callId} ended by ${appParticipant.identity}`);
  }
}
