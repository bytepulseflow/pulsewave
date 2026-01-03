/**
 * Track published message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';
import type { RemoteParticipantImpl } from '../Participant';

export class TrackPublishedHandler extends BaseHandler {
  public readonly type = 'track_published';

  public handle(context: HandlerContext, message: Record<string, unknown>): void {
    const client = context.client as RoomClient;
    const participantSid = message.participantSid as string;

    const participant = client.getParticipant(participantSid) as RemoteParticipantImpl;
    if (participant) {
      // Update participant with new track
      const info = participant.getInfo();
      info.tracks.push(message.track as never);
      participant.updateInfo(info);

      // Emit track published event
      const trackSid = (message.track as { sid: string }).sid;
      this.emit(context, 'track-published', { publication: message.track, participant });

      // Auto-subscribe if enabled
      if (client.options.autoSubscribe !== false) {
        // Initialize WebRTC if not already initialized
        client.ensureWebRTCInitialized().then(() => {
          // Subscribe to the new track
          client
            .subscribeToTrack(trackSid)
            .then(() => console.log(`Auto-subscribed to track ${trackSid}`))
            .catch((error: Error) => console.error('Failed to auto-subscribe to track:', error));
        });
      }
    }
  }
}
