/**
 * Subscribe to track handler
 */

import { CLIENT_EVENTS, ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { SubscribeMessage, TrackSubscribedMessage } from '@bytepulse/pulsewave-shared';
import type { RtpCapabilities, RtpParameters } from 'mediasoup/types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:subscribe');

export class SubscribeHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.SUBSCRIBE;

  public async handle(context: HandlerContext, message: SubscribeMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Not joined to room');
      return;
    }

    const room = this.getRoom(context);
    if (!room) {
      this.sendError(context.ws, ErrorCode.RoomNotFound, 'Room not found');
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Participant not found');
      return;
    }

    try {
      const { transportId, producerId, rtpCapabilities } = message;
      const transport = participant.getTransport(transportId);

      if (!transport) {
        this.sendError(context.ws, ErrorCode.InvalidRequest, 'Transport not found');
        return;
      }

      // Create consumer - cast rtpCapabilities to mediasoup type
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities: rtpCapabilities as RtpCapabilities,
        paused: true,
      });

      // Add consumer to participant
      participant.addConsumer(consumer.id, consumer);

      // Send consumer info to client
      const response: TrackSubscribedMessage = {
        type: 'track_subscribed',
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters as RtpParameters,
        trackSid: producerId,
      };
      this.send(context.ws, response);

      logger.info(`Track subscribed: ${producerId} by ${participant.identity}`);
    } catch (error) {
      logger.error({ error }, 'Failed to subscribe to track');
      this.sendError(context.ws, ErrorCode.Unknown, 'Failed to subscribe to track');
    }
  }
}
