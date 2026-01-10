/**
 * DataConsumerCreatedHandler - Handles data_consumer_created messages
 *
 * Called when the server notifies the client that a new data consumer
 * has been created for receiving data from another participant.
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type {
  ServerMessage,
  DataConsumerCreatedMessage,
  DataChannelKind,
  DataPacket,
} from '@bytepulse/pulsewave-shared';
import {
  DataChannelKind as SharedDataChannelKind,
  DataPacketKind as SharedDataPacketKind,
} from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:data-consumer-created');

export class DataConsumerCreatedHandler extends BaseHandler {
  public readonly type = 'data_consumer_created';

  public async handle(
    context: HandlerContext,
    message: ServerMessage | Record<string, unknown>
  ): Promise<void> {
    const dataConsumerCreatedMessage = message as unknown as DataConsumerCreatedMessage;
    const { id, dataProducerId, participantSid, label, ordered, sctpStreamParameters } =
      dataConsumerCreatedMessage;

    logger.debug(
      `Data consumer created: ${id}, producer: ${dataProducerId}, participant: ${participantSid}`
    );

    // Get the WebRTC controller from the client
    const webRTCController = context.client.getWebRTCController();
    if (!webRTCController) {
      logger.warn('WebRTC controller not available, cannot create data consumer');
      return;
    }

    try {
      // Determine the kind based on label
      const kind: DataChannelKind = label?.includes('lossy')
        ? SharedDataChannelKind.Lossy
        : SharedDataChannelKind.Reliable;

      // Create the data consumer on the WebRTC transport
      const { dataConsumer } = await webRTCController.addDataConsumer(dataProducerId, {
        id,
        sctpStreamParameters,
        participantSid,
        label: label || '',
        ordered,
      });

      logger.info(
        `Data consumer created on WebRTC: ${id}, kind: ${kind}, participant: ${participantSid}`
      );

      // Set up message handler for the data consumer
      dataConsumer.on('message', (data: string | Buffer) => {
        try {
          // Deserialize the data
          const deserializedData = this.deserializeData(data);

          // Create a data packet
          const packet: DataPacket = {
            kind:
              kind === SharedDataChannelKind.Lossy
                ? SharedDataPacketKind.Lossy
                : SharedDataPacketKind.Reliable,
            value: deserializedData,
            participantSid,
            timestamp: Date.now(),
          };

          // Emit the data-received event through the client
          context.client.emit('data-received', {
            data: packet,
            participant: context.client.getParticipant(participantSid),
          });
        } catch (error) {
          logger.error('Failed to handle data consumer message', { error });
        }
      });

      // Set up close handler
      dataConsumer.on('close', () => {
        logger.debug('Data consumer closed', { id });
      });

      // Set up error handler
      dataConsumer.on('error', (error: Error) => {
        logger.error('Data consumer error', { id, error });
      });
    } catch (error) {
      logger.error('Failed to create data consumer', { error });
    }
  }

  /**
   * Deserialize data from transmission
   */
  private deserializeData(data: string | ArrayBuffer | ArrayBufferView): unknown {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }
}
