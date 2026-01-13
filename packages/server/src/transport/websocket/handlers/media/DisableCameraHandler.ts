/**
 * Disable camera intent handler
 */

import { ErrorCode, TrackSource } from '@bytepulse/pulsewave-shared';
import type { DisableCameraIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:disable-camera');

export class DisableCameraHandler extends BaseHandler {
  public readonly type = 'disable_camera';

  public async handle(context: HandlerContext, _message: DisableCameraIntent): Promise<void> {
    const appRoom = this.getApplicationRoom(context);
    const appParticipant = this.getApplicationParticipant(context);

    if (!appRoom || !appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Find the camera track
    const cameraTrack = appParticipant.getTrackBySource(TrackSource.Camera);
    if (!cameraTrack) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Camera track not found');
      return;
    }

    // Remove track from participant
    appParticipant.removeTrack(cameraTrack.sid);

    // Send camera_disabled response to the participant
    this.send(context.ws, {
      type: 'camera_disabled',
      trackSid: cameraTrack.sid,
    });

    // Broadcast track_unpublished to other participants using Application Layer
    context.broadcast(
      appRoom,
      {
        type: 'track_unpublished',
        participantSid: appParticipant.sid,
        trackSid: cameraTrack.sid,
      },
      context.ws.socketId
    );

    logger.info(`Camera disabled for ${appParticipant.identity}`);
  }
}
