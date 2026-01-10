/**
 * CloseDataProducerHandler - Handles close_data_producer messages
 *
 * Closes a mediasoup data producer.
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type {
  CloseDataProducerMessage,
  DataProducerClosedMessage,
} from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:close-data-producer');

export class CloseDataProducerHandler extends BaseHandler {
  public readonly type = 'close_data_producer';

  public async handle(context: HandlerContext, message: CloseDataProducerMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Not joined to room');
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Participant not found');
      return;
    }

    try {
      const { dataProducerId } = message;

      // Remove data producer
      participant.removeDataProducer(dataProducerId);

      logger.info(`Data producer closed: ${dataProducerId} by participant ${participant.identity}`);

      // Send response to client
      const response: DataProducerClosedMessage = {
        type: 'data_producer_closed',
        dataProducerId,
      };
      this.send(context.ws, response);
    } catch (error) {
      logger.error({ error }, 'Failed to close data producer');
      this.sendError(context.ws, ErrorCode.Unknown, 'Failed to close data producer');
    }
  }
}
