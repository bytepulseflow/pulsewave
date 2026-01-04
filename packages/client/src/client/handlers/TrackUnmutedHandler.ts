/**
 * Track unmuted message handler
 */

import type { ServerMessage, TrackUnmutedMessage } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';

export class TrackUnmutedHandler extends BaseHandler {
  public readonly type = 'track_unmuted';

  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const trackUnmutedMessage = message as unknown as TrackUnmutedMessage;
    const client = context.client as RoomClient;

    const participant = client.getParticipant(
      trackUnmutedMessage.participantSid
    ) as RemoteParticipantImpl;
    if (participant) {
      const publication = participant.getTrack(trackUnmutedMessage.trackSid);
      if (publication && publication.track) {
        this.emit(context, 'track-unmuted', { track: publication.track, participant });
      }
    }
  }
}
