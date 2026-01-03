/**
 * Track subscribed message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:track-subscribed');

export class TrackSubscribedHandler extends BaseHandler {
  public readonly type = 'track_subscribed';

  public handle(_context: HandlerContext, message: Record<string, unknown>): void {
    // This is handled by subscribeToTrack method
    logger.debug('Track subscribed:', message);
  }
}
