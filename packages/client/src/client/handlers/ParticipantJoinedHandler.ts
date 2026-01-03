/**
 * Participant joined message handler
 */

import type { TrackSubscribeOptions } from '../../types';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import { RemoteParticipantImpl } from '../Participant';
import type { RoomClient } from '../RoomClient';

export class ParticipantJoinedHandler extends BaseHandler {
  public readonly type = 'participant_joined';

  public handle(context: HandlerContext, message: Record<string, unknown>): void {
    const client = context.client as RoomClient;

    const participant = new RemoteParticipantImpl(message.participant as never);
    participant.setSubscribeCallback(
      async (sid: string, subscribed: boolean, options?: TrackSubscribeOptions) => {
        if (subscribed) {
          client.subscribeToTrack(sid, options);
        } else {
          client.unsubscribeFromTrack(sid);
        }
      }
    );
    client.addParticipant(participant);
    this.emit(context, 'participant-joined', participant);
  }
}
