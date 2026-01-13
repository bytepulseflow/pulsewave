/**
 * Enable camera intent handler
 */

import { ErrorCode, TrackKind, TrackSource, TrackInfo } from '@bytepulse/pulsewave-shared';
import type { EnableCameraIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:enable-camera');

export class EnableCameraHandler extends BaseHandler {
  public readonly type = 'enable_camera';

  public async handle(context: HandlerContext, _message: EnableCameraIntent): Promise<void> {
    const appRoom = this.getApplicationRoom(context);
    const appParticipant = this.getApplicationParticipant(context);

    if (!appRoom || !appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Get or create mediasoup adapter for this room
    let adapter = await this.getAdapter(context);
    if (!adapter) {
      adapter = await this.createAdapter(context);
    }

    // Create a video producer using the mediasoup adapter
    // In production, the client would send rtpParameters in the intent
    const trackSid = `track_${Date.now()}`;

    const trackInfo: TrackInfo = {
      sid: trackSid,
      kind: TrackKind.Video,
      source: TrackSource.Camera,
      muted: false,
    };

    // Add track to participant
    appParticipant.addTrack(trackInfo);

    // Send camera_enabled response to the participant
    this.send(context.ws, {
      type: 'camera_enabled',
      trackSid,
    });

    // Broadcast track_published to other participants using Application Layer
    context.broadcast(
      appRoom,
      {
        type: 'track_published',
        participantSid: appParticipant.sid,
        track: trackInfo,
      },
      context.ws.socketId
    );

    logger.info(`Camera enabled for ${appParticipant.identity}`);
  }
}
