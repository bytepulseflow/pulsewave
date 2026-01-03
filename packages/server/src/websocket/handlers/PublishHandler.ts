/**
 * Publish track handler
 */

import { CLIENT_EVENTS, ErrorCode } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { PublishMessage } from '@bytepulse/pulsewave-shared';

export class PublishHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.PUBLISH;

  public async handle(context: HandlerContext, message: PublishMessage): Promise<void> {
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
      const { transportId, kind, rtpParameters, appData } = message;
      const transport = participant.getTransport(transportId);

      if (!transport) {
        this.sendError(context.ws, ErrorCode.InvalidRequest, 'Transport not found');
        return;
      }

      // Create producer - cast rtpParameters to mediasoup type
      const producer = await transport.produce({
        kind,
        rtpParameters: rtpParameters as any,
        appData,
      });

      // Add producer to participant
      const source = (appData?.source as string) || (kind === 'audio' ? 'microphone' : 'camera');
      const track = participant.addProducer(producer.id, producer, kind, source as any);

      // Notify other participants
      context.broadcast(
        room,
        {
          type: 'track_published',
          participantSid: participant.sid,
          track: track.getInfo(),
        },
        context.ws.socketId
      );

      // Send producer ID to client
      this.send(context.ws, {
        type: 'track_published',
        id: producer.id,
        trackSid: track.sid,
      });

      console.log(`Track published: ${track.sid} by ${participant.identity}`);
    } catch (error) {
      console.error('Failed to publish track:', error);
      this.sendError(context.ws, ErrorCode.Unknown, 'Failed to publish track');
    }
  }
}
