/**
 * Mute track intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { MuteTrackIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:mute-track');

export class MuteTrackHandler extends BaseHandler {
  public readonly type = 'mute_track';

  public async handle(context: HandlerContext, message: MuteTrackIntent): Promise<void> {
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

    // Mute the track
    participant.muteTrack(message.trackSid);

    // Broadcast track_muted to all participants using Application Layer
    context.broadcast(room, {
      type: 'track_muted',
      participantSid: participant.sid,
      trackSid: message.trackSid,
    });

    logger.info(`Track ${message.trackSid} muted by ${participant.identity}`);
  }
}
