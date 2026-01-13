/**
 * Accept call intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { AcceptCallIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:accept-call');

export class AcceptCallHandler extends BaseHandler {
  public readonly type = 'accept_call';

  public async handle(context: HandlerContext, message: AcceptCallIntent): Promise<void> {
    const appParticipant = this.getApplicationParticipant(context);

    if (!appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Participant not found');
      return;
    }

    // Accept call using CallManager
    const result = context.callManager.acceptCall(message.callId);

    if (!result.success || !result.call) {
      this.sendError(context.ws, ErrorCode.NotFound, result.error || 'Call not found');
      return;
    }

    const call = result.call;

    // Send call_accepted to the participant
    this.send(context.ws, {
      type: 'call_accepted',
      callId: call.callId,
      participant: appParticipant.getInfo(),
    });

    // Notify the caller
    const caller = context.applicationRoomManager.getParticipant(call.callerSid);
    if (caller) {
      const callerWs = context.connections.get(caller.socketId);
      if (callerWs) {
        this.send(callerWs, {
          type: 'call_accepted',
          callId: call.callId,
          participant: appParticipant.getInfo(),
        });
      }
    }

    logger.info(`Call ${call.callId} accepted by ${appParticipant.identity}`);
  }
}
