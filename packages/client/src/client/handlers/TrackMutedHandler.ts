/**
 * Track muted message handler
 */

import type { ServerMessage, TrackMutedMessage } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';

export class TrackMutedHandler extends BaseHandler {
  public readonly type = 'track_muted';

  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const trackMutedMessage = message as unknown as TrackMutedMessage;
    const client = context.client as RoomClient;
    const participantSid = trackMutedMessage.participantSid;
    const trackSid = trackMutedMessage.trackSid;

    const participant = client.getParticipant(participantSid) as RemoteParticipantImpl;
    if (participant) {
      const publication = participant.getTrack(trackSid);
      if (publication && publication.track) {
        this.emit(context, 'track-muted', { track: publication.track, participant });
      }
    }
  }
}
