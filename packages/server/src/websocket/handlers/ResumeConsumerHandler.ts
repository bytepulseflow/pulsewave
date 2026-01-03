/**
 * Resume consumer handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { ResumeConsumerMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:resume');

export class ResumeConsumerHandler extends BaseHandler {
  public readonly type = 'resume_consumer';

  public async handle(context: HandlerContext, message: ResumeConsumerMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      return;
    }

    const room = this.getRoom(context);
    if (!room) {
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      return;
    }

    try {
      const { consumerId } = message;
      const consumer = participant.getConsumer(consumerId);

      if (consumer) {
        await consumer.resume();
        logger.info(`Consumer resumed: ${consumerId}`);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to resume consumer');
    }
  }
}
