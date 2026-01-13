/**
 * Send data intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { SendDataIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:send-data');

export class SendDataHandler extends BaseHandler {
  public readonly type = 'send_data';

  public async handle(context: HandlerContext, message: SendDataIntent): Promise<void> {
    const room = this.getApplicationRoom(context);
    const participant = this.getApplicationParticipant(context);

    if (!room || !participant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Broadcast data to all other participants in the room using Application Layer
    context.broadcast(
      room,
      {
        type: 'data_received',
        participantSid: participant.sid,
        payload: message.payload,
        kind: message.kind,
      },
      context.ws.socketId
    );

    logger.info(`Data sent from ${participant.identity}`);
  }
}
