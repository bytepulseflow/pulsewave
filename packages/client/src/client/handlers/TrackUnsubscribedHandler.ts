/**
 * Track unsubscribed message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';
import { RemoteTrack as RemoteTrackImpl } from '../RemoteTrack';

export class TrackUnsubscribedHandler extends BaseHandler {
  public readonly type = 'track_unsubscribed';

  public handle(context: HandlerContext, message: Record<string, unknown>): void {
    const client = context.client as RoomClient;
    const participantSid = message.participantSid as string;
    const trackSid = message.trackSid as string;

    const participant = client.getParticipant(participantSid) as RemoteParticipantImpl;
    if (participant) {
      const publication = participant.getTrack(trackSid);
      if (publication) {
        const track = publication.track;
        (publication as unknown as { clearTrack: () => void }).clearTrack();
        if (track) {
          (track as RemoteTrackImpl).emitUnsubscribed();
          this.emit(context, 'track-unsubscribed', { track, publication, participant });
        }
      }
    }
  }
}
