/**
 * CreateDataProducerHandler - Handles create_data_producer messages
 *
 * Creates a mediasoup data producer for sending data via WebRTC data channels.
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type {
  CreateDataProducerMessage,
  DataProducerCreatedMessage,
  DataChannelKind,
} from '@bytepulse/pulsewave-shared';
import { DataChannelKind as SharedDataChannelKind } from '@bytepulse/pulsewave-shared';
import type { Room } from '../../sfu/Room';
import type { Participant } from '../../sfu/Participant';
import type { DataProducer } from 'mediasoup/types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:create-data-producer');

export class CreateDataProducerHandler extends BaseHandler {
  public readonly type = 'create_data_producer';

  public async handle(context: HandlerContext, message: CreateDataProducerMessage): Promise<void> {
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

    if (!participant.permission.canPublishData) {
      this.sendError(context.ws, ErrorCode.PermissionDenied, 'Participant cannot publish data');
      return;
    }

    try {
      const {
        transportId,
        label,
        protocol,
        ordered,
        maxPacketLifeTime,
        maxRetransmits,
        sctpStreamParameters,
      } = message;
      const transport = participant.getTransport(transportId);

      if (!transport) {
        this.sendError(context.ws, ErrorCode.InvalidRequest, 'Transport not found');
        return;
      }

      // Create data producer on the transport
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataProducer = await (transport as any).produceData({
        label,
        protocol,
        ordered: ordered !== false,
        maxPacketLifeTime,
        maxRetransmits,
        sctpStreamParameters,
      });

      // Determine kind based on label
      const kind: DataChannelKind = label.includes('lossy')
        ? SharedDataChannelKind.Lossy
        : SharedDataChannelKind.Reliable;

      // Store data producer
      participant.addDataProducer(dataProducer.id, dataProducer, kind);

      logger.info(
        `Data producer created: ${dataProducer.id} for participant ${participant.identity}, kind: ${kind}`
      );

      // Send response to client (needed for the transport's producedata callback)
      const response: DataProducerCreatedMessage = {
        type: 'data_producer_created',
        id: dataProducer.id,
      };
      this.send(context.ws, response);

      // Notify other participants about new data producer
      const otherParticipants = room.getParticipants().filter((p) => p.sid !== participant.sid);
      for (const otherParticipant of otherParticipants) {
        // Create data consumer for other participants
        await this.createDataConsumerForParticipant(
          room,
          otherParticipant,
          dataProducer,
          participant,
          context
        );
      }
    } catch (error) {
      logger.error({ error }, 'Failed to create data producer');
      this.sendError(context.ws, ErrorCode.Unknown, 'Failed to create data producer');
    }
  }

  /**
   * Create a data consumer for a participant
   */
  private async createDataConsumerForParticipant(
    _room: Room,
    participant: Participant,
    dataProducer: DataProducer,
    producerParticipant: Participant,
    context: HandlerContext
  ): Promise<void> {
    try {
      // Get a receive transport for the participant
      const recvTransport = participant.getReceiveTransport();

      if (!recvTransport) {
        logger.warn(`No receive transport found for participant ${participant.identity}`);
        return;
      }

      // Create data consumer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataConsumer = await (recvTransport as any).consumeData({
        dataProducerId: dataProducer.id,
      });

      // Store data consumer
      participant.addDataConsumer(dataConsumer.id, dataConsumer);

      logger.info(
        `Data consumer created: ${dataConsumer.id} for participant ${participant.identity}, producer: ${dataProducer.id}`
      );

      // Notify the participant about the new data consumer
      const otherWs = context.connections.get(participant.socketId);
      if (otherWs) {
        this.send(otherWs, {
          type: 'data_consumer_created',
          id: dataConsumer.id,
          dataProducerId: dataProducer.id,
          participantSid: producerParticipant.sid,
          label: dataProducer.label,
          protocol: dataProducer.protocol,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ordered: (dataConsumer as any).ordered,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sctpStreamParameters: (dataConsumer as any).sctpStreamParameters,
        });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to create data consumer');
    }
  }
}
