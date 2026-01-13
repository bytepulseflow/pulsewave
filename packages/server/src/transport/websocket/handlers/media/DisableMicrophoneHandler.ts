/**
 * Disable microphone intent handler
 */

import { ErrorCode, TrackSource } from '@bytepulse/pulsewave-shared';
import type { DisableMicrophoneIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:disable-microphone');

export class DisableMicrophoneHandler extends BaseHandler {
  public readonly type = 'disable_microphone';

  public async handle(context: HandlerContext, _message: DisableMicrophoneIntent): Promise<void> {
    const appRoom = this.getApplicationRoom(context);
    const appParticipant = this.getApplicationParticipant(context);

    if (!appRoom || !appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Find the microphone track
    const microphoneTrack = appParticipant.getTrackBySource(TrackSource.Microphone);
    if (!microphoneTrack) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Microphone track not found');
      return;
    }

    // Remove track from participant
    appParticipant.removeTrack(microphoneTrack.sid);

    // Send microphone_disabled response to the participant
    this.send(context.ws, {
      type: 'microphone_disabled',
      trackSid: microphoneTrack.sid,
    });

    // Broadcast track_unpublished to other participants using Application Layer
    context.broadcast(
      appRoom,
      {
        type: 'track_unpublished',
        participantSid: appParticipant.sid,
        trackSid: microphoneTrack.sid,
      },
      context.ws.socketId
    );

    logger.info(`Microphone disabled for ${appParticipant.identity}`);
  }
}
