/**
 * Data channel message handler
 */

import { CLIENT_EVENTS } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { DataMessage } from '@bytepulse/pulsewave-shared';

export class DataHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.DATA;

  public async handle(context: HandlerContext, message: DataMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      return;
    }

    const room = this.getRoom(context);
    if (!room) {
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      return;
    }

    try {
      const { kind, payload } = message;

      // Broadcast data to other participants
      context.broadcast(
        room,
        {
          type: 'data',
          participantSid: participant.sid,
          payload,
        },
        context.ws.socketId
      );

      console.log(`Data message received from ${participant.sid}: ${kind}`);
    } catch (error) {
      console.error('Failed to handle data message:', error);
    }
  }
}
