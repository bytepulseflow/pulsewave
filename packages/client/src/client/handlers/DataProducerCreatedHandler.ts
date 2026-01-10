/**
 * DataProducerCreatedHandler - Handles data_producer_created messages
 *
 * This is a simple handler that acknowledges the data producer creation.
 * The actual data producer is created in WebRTCManager via the transport's
 * producedata event, and this message is sent back to complete the flow.
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { ServerMessage, DataProducerCreatedMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:data-producer-created');

export class DataProducerCreatedHandler extends BaseHandler {
  public readonly type = 'data_producer_created';

  public async handle(
    _context: HandlerContext,
    message: ServerMessage | Record<string, unknown>
  ): Promise<void> {
    const dataProducerCreatedMessage = message as unknown as DataProducerCreatedMessage;
    const { id } = dataProducerCreatedMessage;

    logger.debug(`Data producer created: ${id}`);

    // The data producer is already created in WebRTCManager
    // This handler just ensures the message is processed without warnings
  }
}
