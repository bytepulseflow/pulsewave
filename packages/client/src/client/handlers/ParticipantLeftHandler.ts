/**
 * Participant left message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';

export class ParticipantLeftHandler extends BaseHandler {
  public readonly type = 'participant_left';

  public handle(context: HandlerContext, message: Record<string, unknown>): void {
    const client = context.client as RoomClient;
    const participantSid = message.participantSid as string;

    const participant = client.getParticipant(participantSid);
    if (participant) {
      participant.removeAllListeners();
      client.removeParticipant(participantSid);
      this.emit(context, 'participant-left', participant);
    }
  }
}
