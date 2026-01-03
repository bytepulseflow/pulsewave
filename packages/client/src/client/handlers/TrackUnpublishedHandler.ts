/**
 * Track unpublished message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:track-unpublished');

export class TrackUnpublishedHandler extends BaseHandler {
  public readonly type = 'track_unpublished';

  public handle(context: HandlerContext, message: Record<string, unknown>): void {
    const client = context.client as RoomClient;
    const participantSid = message.participantSid as string;
    const trackSid = message.trackSid as string;

    const participant = client.getParticipant(participantSid) as RemoteParticipantImpl;
    if (participant) {
      // Get the publication before removing it
      const publication = participant.getTrack(trackSid);

      // Remove the track from participant's tracks map
      (participant as unknown as { tracks: Map<string, unknown> }).tracks.delete(trackSid);

      // Emit track-unpublished event
      if (publication) {
        (publication as unknown as { clearTrack: () => void }).clearTrack();
        this.emit(context, 'track-unpublished', { publication, participant });
      }

      logger.info(`Track unpublished: ${trackSid} from participant ${participant.identity}`);
    }
  }
}
