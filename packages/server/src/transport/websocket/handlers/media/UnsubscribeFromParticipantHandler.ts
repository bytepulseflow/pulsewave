/**
 * Unsubscribe from participant intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { UnsubscribeFromParticipantIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:unsubscribe-from-participant');

export class UnsubscribeFromParticipantHandler extends BaseHandler {
  public readonly type = 'unsubscribe_from_participant';

  public async handle(
    context: HandlerContext,
    message: UnsubscribeFromParticipantIntent
  ): Promise<void> {
    const room = this.getApplicationRoom(context);
    const participant = this.getApplicationParticipant(context);

    if (!room || !participant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Room or participant not found');
      return;
    }

    // Validate target participant
    const targetParticipant = room.getParticipant(message.participantSid);
    if (!targetParticipant) {
      this.sendError(context.ws, ErrorCode.NotFound, 'Target participant not found');
      return;
    }

    // Get the mediasoup adapter for this room
    const adapter = await this.getAdapter(context);
    if (!adapter) {
      this.sendError(context.ws, ErrorCode.Unknown, 'Mediasoup adapter not found');
      return;
    }

    // Get consumer IDs for this target participant
    const consumerIds = participant.getConsumerIds(targetParticipant.sid);

    // Close all consumers for the target participant
    for (const consumerId of consumerIds) {
      try {
        await adapter.closeConsumer(consumerId);
        logger.debug(`Closed consumer ${consumerId}`);
      } catch (error) {
        logger.error(`Failed to close consumer ${consumerId}: ${String(error)}`);
      }
    }

    // Remove consumer IDs tracking
    participant.removeConsumerIds(targetParticipant.sid);

    // Send track_unsubscribed responses for all tracks
    for (const track of targetParticipant.getTracks()) {
      this.send(context.ws, {
        type: 'track_unsubscribed',
        participantSid: targetParticipant.sid,
        trackSid: track.sid,
      });
    }

    logger.info(
      `Participant ${participant.identity} unsubscribed from ${targetParticipant.identity}`
    );
  }
}
