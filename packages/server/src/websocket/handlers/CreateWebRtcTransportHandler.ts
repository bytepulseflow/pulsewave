/**
 * Create WebRTC transport handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CreateTransportMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:transport');

export class CreateWebRtcTransportHandler extends BaseHandler {
  public readonly type = 'create_transport';

  public async handle(context: HandlerContext, message: CreateTransportMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Not joined to room');
      return;
    }

    const room = this.getRoom(context);
    if (!room) {
      this.sendError(context.ws, ErrorCode.RoomNotFound, 'Room not found');
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Participant not found');
      return;
    }

    try {
      const { direction } = message;

      // Create WebRTC transport
      const transport = await room.createWebRtcTransport({
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
          },
        ],
        initialAvailableOutgoingBitrate: 1000000,
      });

      // Store transport
      participant.addTransport(transport.id, transport);

      // Send transport info to client
      this.send(context.ws, {
        type: 'transport_created',
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        direction,
      });

      logger.info(`WebRTC transport created for participant ${participant.identity}`);
    } catch (error) {
      logger.error({ error }, 'Failed to create WebRTC transport');
      this.sendError(context.ws, ErrorCode.Unknown, 'Failed to create transport');
    }
  }
}
