/**
 * Leave room intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { LeaveRoomIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:leave-room');

export class LeaveRoomHandler extends BaseHandler {
  public readonly type = 'leave_room';

  public async handle(context: HandlerContext, _message: LeaveRoomIntent): Promise<void> {
    const room = this.getApplicationRoom(context);
    const participant = this.getApplicationParticipant(context);

    if (!room || !participant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Remove participant from room
    room.removeParticipant(participant.sid);

    // Notify other participants using Application Layer
    context.broadcast(
      room,
      {
        type: 'participant_left',
        participantSid: participant.sid,
      },
      context.ws.socketId
    );

    // Clear socket references
    context.ws.participantSid = undefined;
    context.ws.roomSid = undefined;

    logger.info(`Participant ${participant.identity} left room ${room.name}`);
  }
}
