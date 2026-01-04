/**
 * Transport Connected Handler
 *
 * Handles transport_connected messages from the server.
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { TransportConnectedMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('transport-connected-handler');

export class TransportConnectedHandler extends BaseHandler {
  readonly type = 'transport_connected';

  handle(_context: HandlerContext, message: TransportConnectedMessage): void {
    logger.debug('Transport connected', {
      transportId: message.transportId,
    });

    // The WebRTC controller will handle the transport connection
    // This handler is mainly for logging purposes
  }
}
