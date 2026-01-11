/**
 * Track published message handler
 */

import type { ServerMessage, TrackPublishedMessage } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:track-published');

export class TrackPublishedHandler extends BaseHandler {
  public readonly type = 'track_published';

  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const trackPublishedMessage = message as unknown as TrackPublishedMessage;
    const client = context.client as RoomClient;
    const participantSid = trackPublishedMessage.participantSid;

    const participant = client.getParticipant(participantSid) as RemoteParticipantImpl;
    if (participant) {
      const trackSid = trackPublishedMessage.track.sid;

      // Update participant with new track
      const info = participant.getInfo();

      // Only add if not already in the list (to avoid duplicates)
      if (!info.tracks.some((t) => t.sid === trackSid)) {
        info.tracks.push(trackPublishedMessage.track);
      }

      participant.updateInfo(info);

      // Emit track published event
      this.emit(context, 'track-published', {
        publication: trackPublishedMessage.track,
        participant,
      });

      // Auto-subscribe if enabled
      if (client.options.autoSubscribe !== false) {
        // Initialize WebRTC if not already initialized
        client.ensureWebRTCInitialized().then(() => {
          // Subscribe to the track (even if it's a re-publication)
          client
            .subscribeToTrack(trackSid)
            .then(() => logger.debug(`Auto-subscribed to track ${trackSid}`))
            .catch((error: Error) => logger.error('Failed to auto-subscribe to track', { error }));
        });
      }
    }
  }
}
