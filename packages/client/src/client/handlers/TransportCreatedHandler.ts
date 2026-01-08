/**
 * Transport Created Handler
 *
 * Handles transport_created messages from the server.
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { TransportCreatedMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('transport-created-handler');

export class TransportCreatedHandler extends BaseHandler {
  readonly type = 'transport_created';

  handle(_context: HandlerContext, message: TransportCreatedMessage): void {
    logger.debug('Transport created', {
      id: message.id,
      direction: message.direction,
    });

    // The WebRTC controller will handle the transport creation
    // This handler is mainly for logging purposes
    // The transport creation is handled by the WebRTCManager
  }
}
