/**
 * DataConsumerClosedHandler - Handles data_consumer_closed messages
 *
 * Called when the server notifies the client that a data consumer
 * has been closed.
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { ServerMessage, DataConsumerClosedMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:data-consumer-closed');

export class DataConsumerClosedHandler extends BaseHandler {
  public readonly type = 'data_consumer_closed';

  public handle(_context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const dataConsumerClosedMessage = message as unknown as DataConsumerClosedMessage;
    const { dataConsumerId } = dataConsumerClosedMessage;

    logger.debug(`Data consumer closed: ${dataConsumerId}`);

    // This is handled by the WebRTC data provider
    // The RoomClient will handle this through its data provider integration
  }
}
