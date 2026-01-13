/**
 * Unmute track intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { UnmuteTrackIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:unmute-track');

export class UnmuteTrackHandler extends BaseHandler {
  public readonly type = 'unmute_track';

  public async handle(context: HandlerContext, message: UnmuteTrackIntent): Promise<void> {
    const room = this.getApplicationRoom(context);
    const participant = this.getApplicationParticipant(context);

    if (!room || !participant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Find the track
    const track = participant.getTrack(message.trackSid);
    if (!track) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Track not found');
      return;
    }

    // Unmute the track
    participant.unmuteTrack(message.trackSid);

    // Broadcast track_unmuted to all participants using Application Layer
    context.broadcast(room, {
      type: 'track_unmuted',
      participantSid: participant.sid,
      trackSid: message.trackSid,
    });

    logger.info(`Track ${message.trackSid} unmuted by ${participant.identity}`);
  }
}
