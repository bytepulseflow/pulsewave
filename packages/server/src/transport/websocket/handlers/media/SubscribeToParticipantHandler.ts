/**
 * Subscribe to participant intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { SubscribeToParticipantIntent } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from '../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';

const logger = createModuleLogger('handler:subscribe-to-participant');

export class SubscribeToParticipantHandler extends BaseHandler {
  public readonly type = 'subscribe_to_participant';

  public async handle(
    context: HandlerContext,
    message: SubscribeToParticipantIntent
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

    // Ensure participant has a receive transport
    const receiveTransportId = participant.getReceiveTransportId();
    if (!receiveTransportId) {
      this.sendError(context.ws, ErrorCode.TransportError, 'Receive transport not found');
      return;
    }

    // Create consumers for all tracks of the target participant
    for (const track of targetParticipant.getTracks()) {
      try {
        // Get the producer ID for this track
        const producerId = targetParticipant.getProducerId(track.sid);
        if (!producerId) {
          logger.warn(`No producer found for track ${track.sid}, skipping subscription`);
          continue;
        }

        // Create consumer through the mediasoup adapter
        const consumerInfo = await adapter.createConsumer(receiveTransportId, {
          producerId,
          rtpCapabilities: adapter.getRtpCapabilities(),
          paused: false,
        });

        // Track the consumer ID
        participant.addConsumerId(targetParticipant.sid, consumerInfo.id);

        // Send track_subscribed response with consumer information
        this.send(context.ws, {
          type: 'track_subscribed',
          participantSid: targetParticipant.sid,
          track: track,
          consumerId: consumerInfo.id,
          rtpParameters: consumerInfo.rtpParameters,
        });

        logger.debug(`Created consumer ${consumerInfo.id} for track ${track.sid}`);
      } catch (error) {
        logger.error(`Failed to subscribe to track ${track.sid}: ${String(error)}`);
        this.sendError(
          context.ws,
          ErrorCode.TrackSubscribeError,
          `Failed to subscribe to track: ${String(error)}`
        );
      }
    }

    logger.info(`Participant ${participant.identity} subscribed to ${targetParticipant.identity}`);
  }
}
