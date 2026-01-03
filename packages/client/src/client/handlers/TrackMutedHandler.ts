/**
 * Track muted message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';

export class TrackMutedHandler extends BaseHandler {
  public readonly type = 'track_muted';

  public handle(context: HandlerContext, message: Record<string, unknown>): void {
    const client = context.client as RoomClient;
    const participantSid = message.participantSid as string;
    const trackSid = message.trackSid as string;

    const participant = client.getParticipant(participantSid) as RemoteParticipantImpl;
    if (participant) {
      participant.updateInfo(message.participant as never);
      const publication = participant.getTrack(trackSid);
      if (publication && publication.track) {
        this.emit(context, 'track-muted', { track: publication.track, participant });
      }
    }
  }
}
