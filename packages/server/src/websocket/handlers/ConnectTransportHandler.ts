/**
 * Connect WebRTC transport handler
 */

import { CLIENT_EVENTS } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { ConnectTransportMessage } from '@bytepulse/pulsewave-shared';

export class ConnectTransportHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.CONNECT_TRANSPORT;

  public async handle(context: HandlerContext, message: ConnectTransportMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      return;
    }

    try {
      const { transportId, dtlsParameters } = message;

      const transport = participant.getTransport(transportId);
      if (!transport) {
        this.sendError(context.ws, 404, `Transport not found: ${transportId}`);
        return;
      }

      await transport.connect({ dtlsParameters });

      this.send(context.ws, {
        type: 'transport_connected',
        transportId,
      });

      console.log(`Transport connected: ${transportId}`);
    } catch (error) {
      console.error('Failed to connect transport:', error);
      this.sendError(context.ws, 500, 'Failed to connect transport');
    }
  }
}
