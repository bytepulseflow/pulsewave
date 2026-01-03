/**
 * Track unmuted message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { TrackUnmutedMessage } from '@bytepulse/pulsewave-shared';

export class TrackUnmutedHandler extends BaseHandler {
  public readonly type = 'track_unmuted';

  public handle(context: HandlerContext, message: TrackUnmutedMessage): void {
    const client = context.client as { getParticipant: (sid: string) => unknown };

    const participant = client.getParticipant(message.participantSid);
    if (participant) {
      const participantObj = participant as { getTrack: (sid: string) => unknown };
      const publication = participantObj.getTrack(message.trackSid);
      const publicationObj = publication as { track?: unknown };
      if (publicationObj && publicationObj.track) {
        this.emit(context, 'track-unmuted', { track: publicationObj.track, participant });
      }
    }
  }
}
