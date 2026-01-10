/**
 * Data message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { DataReceivedMessage, DataPacket, DataPacketKind } from '@bytepulse/pulsewave-shared';

export class DataHandler extends BaseHandler {
  public readonly type = 'data';

  public handle(context: HandlerContext, message: DataReceivedMessage): void {
    const client = context.client as { getParticipant: (sid: string) => unknown };

    const participant = client.getParticipant(message.participantSid);
    if (participant) {
      // Create a DataPacket structure for consistency
      const dataPacket: DataPacket = {
        kind: (message.kind || 'reliable') as DataPacketKind,
        value: message.payload,
        participantSid: message.participantSid,
        timestamp: Date.now(),
      };

      this.emit(context, 'data-received', { data: dataPacket, participant });
    }
  }
}
