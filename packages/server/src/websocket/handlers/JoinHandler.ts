/**
 * Join room message handler
 */

import { CLIENT_EVENTS, ErrorCode, ConnectionState } from '@bytepulse/pulsewave-shared';
import { validateToken } from '../../auth';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { JoinMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';
import { Participant } from '../../sfu/Participant';

const logger = createModuleLogger('handler:join');

export class JoinHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.JOIN;

  public async handle(context: HandlerContext, message: JoinMessage): Promise<void> {
    const { room: roomName, token, metadata } = message;

    // Validate token
    const validation = validateToken(token, context.jwtConfig.apiSecret, context.jwtConfig.apiKey);
    if (!validation.valid) {
      this.sendError(context.ws, ErrorCode.Unauthorized, validation.error || 'Invalid token');
      return;
    }

    if (!validation.claims) {
      this.sendError(context.ws, ErrorCode.Unauthorized, 'Invalid token claims');
      return;
    }

    const claims = validation.claims;

    // Check if user has permission to join
    if (claims.video?.roomJoin === false) {
      this.sendError(context.ws, ErrorCode.Unauthorized, 'Not authorized to join room');
      return;
    }

    // Get or create room
    let room = context.roomManager.getRoomByName(roomName);
    if (!room) {
      room = await context.roomManager.createRoom({
        name: roomName,
        metadata: {},
      });
    }

    // Check if room is full
    if (room.isFull()) {
      this.sendError(context.ws, ErrorCode.RoomFull, 'Room is full');
      return;
    }

    // Create participant
    const participant = new Participant(
      room,
      claims.identity,
      claims.name,
      { ...metadata, ...claims.metadata },
      {
        canPublish: claims.video?.canPublish ?? true,
        canSubscribe: claims.video?.canSubscribe ?? true,
        canPublishData: claims.video?.canPublishData ?? true,
      }
    );

    participant.setSocketId(context.ws.socketId);
    participant.setState(ConnectionState.Connected);
    room.addParticipant(participant);

    context.ws.participantSid = participant.sid;
    context.ws.roomSid = room.sid;

    // Send joined message with RTP capabilities
    const mediasoupRtpCapabilities = room.getRtpCapabilities();
    this.send(context.ws, {
      type: 'joined',
      room: room.getInfo(),
      participant: participant.getInfo(),
      otherParticipants: room
        .getParticipants()
        .filter((p) => p.sid !== participant.sid)
        .map((p) => p.getInfo()),
      rtpCapabilities: {
        codecs: mediasoupRtpCapabilities.codecs || [],
        headerExtensions: mediasoupRtpCapabilities.headerExtensions || [],
      },
    });

    // Notify other participants
    context.broadcast(
      room,
      {
        type: 'participant_joined',
        participant: participant.getInfo(),
      },
      context.ws.socketId
    );

    logger.info(`Participant ${participant.identity} joined room ${roomName}`);
  }
}
