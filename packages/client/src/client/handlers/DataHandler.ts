/**
 * Data message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { DataReceivedMessage } from '@bytepulse/pulsewave-shared';

export class DataHandler extends BaseHandler {
  public readonly type = 'data';

  public handle(context: HandlerContext, message: DataReceivedMessage): void {
    const client = context.client as { getParticipant: (sid: string) => unknown };

    const participant = client.getParticipant(message.participantSid);
    if (participant) {
      this.emit(context, 'data-received', { data: message.payload, participant });
    }
  }
}
