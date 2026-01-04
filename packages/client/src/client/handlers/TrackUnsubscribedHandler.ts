/**
 * Track unsubscribed message handler
 */

import type { ServerMessage, TrackUnsubscribedMessage } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';
import { RemoteTrack as RemoteTrackImpl } from '../RemoteTrack';

export class TrackUnsubscribedHandler extends BaseHandler {
  public readonly type = 'track_unsubscribed';

  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const trackUnsubscribedMessage = message as unknown as TrackUnsubscribedMessage;
    const client = context.client as RoomClient;
    const trackSid = trackUnsubscribedMessage.trackSid;

    // Find the participant that has this track
    const participants = client.getParticipants();
    let foundParticipant: RemoteParticipantImpl | null = null;
    let foundPublication: unknown = null;

    for (const participant of participants) {
      const participantImpl = participant as RemoteParticipantImpl;
      const publication = participantImpl.getTrack(trackSid);
      if (publication) {
        foundParticipant = participantImpl;
        foundPublication = publication;
        break;
      }
    }

    if (foundParticipant && foundPublication) {
      const publication = foundPublication as { track?: unknown; clearTrack: () => void };
      const track = publication.track;
      publication.clearTrack();
      if (track) {
        (track as RemoteTrackImpl).emitUnsubscribed();
        this.emit(context, 'track-unsubscribed', {
          track,
          publication: foundPublication,
          participant: foundParticipant,
        });
      }
    }
  }
}
