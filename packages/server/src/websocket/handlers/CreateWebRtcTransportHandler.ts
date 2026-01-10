/**
 * Create WebRTC transport handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CreateTransportMessage } from '@bytepulse/pulsewave-shared';
import type { Room } from '../../sfu/Room';
import type { Participant } from '../../sfu/Participant';
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
        enableSctp: true,
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
          },
        ],
        initialAvailableOutgoingBitrate: 1000000,
      });

      // Store transport with direction
      participant.addTransport(transport.id, transport, direction);

      // Send transport info to client
      // SCTP parameters are provided by the transport when enableSctp is true
      this.send(context.ws, {
        type: 'transport_created',
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
        direction,
      });

      logger.info(
        `WebRTC transport created for participant ${participant.identity}, direction: ${direction}`
      );

      // If this is a receive transport, create data consumers for existing data producers
      if (direction === 'recv') {
        await this.createDataConsumersForExistingProducers(room, participant, context);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to create WebRTC transport');
      this.sendError(context.ws, ErrorCode.Unknown, 'Failed to create transport');
    }
  }

  /**
   * Create data consumers for existing data producers from other participants
   */
  private async createDataConsumersForExistingProducers(
    room: Room,
    participant: Participant,
    context: HandlerContext
  ): Promise<void> {
    const recvTransport = participant.getReceiveTransport();

    if (!recvTransport) {
      logger.warn(`No receive transport found for participant ${participant.identity}`);
      return;
    }

    const otherParticipants = room
      .getParticipants()
      .filter((p: Participant) => p.sid !== participant.sid);

    for (const otherParticipant of otherParticipants) {
      const dataProducers = otherParticipant.getDataProducers();

      for (const [dataProducerId, dataProducer] of dataProducers.entries()) {
        try {
          // Create data consumer
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dataConsumer = await (recvTransport as any).consumeData({
            dataProducerId,
          });

          // Store data consumer
          participant.addDataConsumer(dataConsumer.id, dataConsumer);

          logger.info(
            `Data consumer created: ${dataConsumer.id} for participant ${participant.identity}, producer: ${dataProducerId}`
          );

          // Notify the participant about the new data consumer
          this.send(context.ws, {
            type: 'data_consumer_created',
            id: dataConsumer.id,
            dataProducerId,
            participantSid: otherParticipant.sid,
            label: dataProducer.label,
            protocol: dataProducer.protocol,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ordered: (dataConsumer as any).ordered,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sctpStreamParameters: (dataConsumer as any).sctpStreamParameters,
          });
        } catch (error) {
          logger.error({ error }, `Failed to create data consumer for producer ${dataProducerId}`);
        }
      }
    }
  }
}
