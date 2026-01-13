/**
 * Start call intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { StartCallIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:start-call');

export class StartCallHandler extends BaseHandler {
  public readonly type = 'start_call';

  public async handle(context: HandlerContext, message: StartCallIntent): Promise<void> {
    const appRoom = this.getApplicationRoom(context);
    const appParticipant = this.getApplicationParticipant(context);

    if (!appRoom || !appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Validate target participant by userId (identity)
    const targetParticipant = appRoom.getParticipantByIdentity(message.targetUserId);
    if (!targetParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Target user not found in room');
      return;
    }

    // Start call using CallManager
    const result = context.callManager.startCall(
      appParticipant.sid,
      targetParticipant.sid,
      message.metadata
    );

    if (!result.success || !result.call) {
      this.sendError(context.ws, ErrorCode.Unknown, result.error || 'Failed to start call');
      return;
    }

    const call = result.call;

    // Send call_received to target participant
    const targetWs = context.connections.get(targetParticipant.socketId);
    if (targetWs) {
      this.send(targetWs, {
        type: 'call_received',
        callId: call.callId,
        caller: appParticipant.getInfo(),
        metadata: call.metadata,
      });
    }

    // Send call_started confirmation to caller
    this.send(context.ws, {
      type: 'call_started',
      callId: call.callId,
      target: targetParticipant.getInfo(),
    });

    logger.info(
      `Call ${call.callId} started from ${appParticipant.identity} to ${targetParticipant.identity}`
    );
  }
}
