/**
 * Participant left message handler
 */

import type { ParticipantLeftMessage, ServerMessage } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { RoomClient } from '../RoomClient';

export class ParticipantLeftHandler extends BaseHandler {
  public readonly type = 'participant_left';

  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const participantLeftMessage = message as unknown as ParticipantLeftMessage;
    const client = context.client as RoomClient;
    const participantSid = participantLeftMessage.participantSid;

    const participant = client.getParticipant(participantSid);
    if (participant) {
      participant.removeAllListeners();
      client.removeParticipant(participantSid);
      this.emit(context, 'participant-left', participant);
    }
  }
}
