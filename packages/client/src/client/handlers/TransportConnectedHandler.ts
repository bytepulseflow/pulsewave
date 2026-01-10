/**
 * Transport Connected Handler
 *
 * Handles transport_connected messages from the server.
 *
 * Note: Transport connection events are now handled directly in WebRTCManager's
 * setupTransportListeners method. This handler is kept for logging purposes.
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { TransportConnectedMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('transport-connected-handler');

export class TransportConnectedHandler extends BaseHandler {
  readonly type = 'transport_connected';

  handle(_context: HandlerContext, message: TransportConnectedMessage): void {
    logger.info('Transport connected', {
      transportId: message.transportId,
    });

    // Transport connection events are now handled directly in WebRTCManager
    // No action needed here as the event is already processed in setupTransportListeners
  }
}
