/**
 * Data message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';

export class DataHandler extends BaseHandler {
  public readonly type = 'data';

  public handle(context: HandlerContext, message: any): void {
    const client = context.client as any;

    const participant = client.participants.get(message.participantSid);
    if (participant) {
      this.emit(context, 'data-received', { data: message.data, participant });
    }
  }
}
