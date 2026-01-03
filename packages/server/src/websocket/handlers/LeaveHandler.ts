/**
 * Leave room message handler
 */

import { CLIENT_EVENTS } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { LeaveMessage } from '@bytepulse/pulsewave-shared';

export class LeaveHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.LEAVE;

  public async handle(context: HandlerContext, _message: LeaveMessage): Promise<void> {
    if (!context.ws.roomSid || !context.ws.participantSid) {
      return;
    }

    const room = context.roomManager.getRoom(context.ws.roomSid);
    if (!room) {
      return;
    }

    const participant = room.getParticipant(context.ws.participantSid);
    if (!participant) {
      return;
    }

    // Notify other participants
    context.broadcast(
      room,
      {
        type: 'participant_left',
        participantSid: participant.sid,
      },
      context.ws.socketId
    );

    // Remove participant
    room.removeParticipant(participant.sid);

    console.log(`Participant ${participant.identity} left room ${room.name}`);

    // Clear connection data
    context.ws.participantSid = undefined;
    context.ws.roomSid = undefined;
  }
}
