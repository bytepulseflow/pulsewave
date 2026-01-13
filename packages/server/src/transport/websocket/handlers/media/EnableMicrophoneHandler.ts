/**
 * Enable microphone intent handler
 */

import { ErrorCode, TrackKind, TrackSource, TrackInfo } from '@bytepulse/pulsewave-shared';
import type { EnableMicrophoneIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:enable-microphone');

export class EnableMicrophoneHandler extends BaseHandler {
  public readonly type = 'enable_microphone';

  public async handle(context: HandlerContext, _message: EnableMicrophoneIntent): Promise<void> {
    const appRoom = this.getApplicationRoom(context);
    const appParticipant = this.getApplicationParticipant(context);

    if (!appRoom || !appParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Create an audio producer using the mediasoup adapter
    // In production, the client would send rtpParameters in the intent
    const trackSid = `track_${Date.now()}`;

    const trackInfo: TrackInfo = {
      sid: trackSid,
      kind: TrackKind.Audio,
      source: TrackSource.Microphone,
      muted: false,
    };

    // Add track to participant
    appParticipant.addTrack(trackInfo);

    // Send microphone_enabled response to the participant
    this.send(context.ws, {
      type: 'microphone_enabled',
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

    logger.info(`Microphone enabled for ${appParticipant.identity}`);
  }
}
