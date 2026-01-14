/**
 * Join room intent handler
 */

import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { JoinRoomIntent } from '@bytepulse/pulsewave-shared';
import { validateToken } from '../../../../auth';
import { BaseHandler } from './../BaseHandler';
import type { HandlerContext } from '../types';
import { createModuleLogger } from '../../../../utils/logger';
import { ApplicationParticipant } from '../../../../application';
import type { ParticipantInfo } from '@bytepulse/pulsewave-shared';

const logger = createModuleLogger('handler:join-room');

export class JoinRoomHandler extends BaseHandler {
  public readonly type = 'join_room';

  public async handle(context: HandlerContext, message: JoinRoomIntent): Promise<void> {
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

    // Get or create application room
    let appRoom = context.applicationRoomManager.getRoomByName(roomName);
    if (!appRoom) {
      const result = context.applicationRoomManager.createRoom(roomName, {
        ...metadata,
        ...claims.metadata,
      });
      if (!result.success || !result.room) {
        this.sendError(context.ws, ErrorCode.Unknown, result.error || 'Failed to create room');
        return;
      }
      appRoom = result.room;
    }

    // Check if room is full
    if (appRoom.isFull()) {
      this.sendError(context.ws, ErrorCode.RoomFull, 'Room is full');
      return;
    }

    // Create application participant
    const participant = new ApplicationParticipant(
      claims.identity,
      claims.name || claims.identity,
      { ...metadata, ...claims.metadata },
      {
        canPublish: claims.video?.canPublish ?? true,
        canSubscribe: claims.video?.canSubscribe ?? true,
        canPublishData: claims.video?.canPublishData ?? true,
      }
    );

    participant.setSocketId(context.ws.socketId);
    appRoom.addParticipant(participant);

    context.ws.participantSid = participant.sid;
    context.ws.roomSid = appRoom.sid;

    // Create mediasoup adapter for this room if it doesn't exist
    let adapter = await this.getAdapter(context);
    if (!adapter) {
      adapter = await this.createAdapter(context);
      logger.info(`Created mediasoup adapter for room ${appRoom.sid}`);
    }

    // Send room joined response (intent-based)
    this.send(context.ws, {
      type: 'room_joined',
      room: appRoom.getInfo(),
      participant: participant.getInfo(),
      otherParticipants: appRoom
        .getParticipants()
        .filter((p) => p.sid !== participant.sid)
        .map((p): ParticipantInfo => p.getInfo()),
    });

    // Notify other participants using Application Layer
    context.broadcast(
      appRoom,
      {
        type: 'participant_joined',
        participant: participant.getInfo(),
      },
      context.ws.socketId
    );

    logger.info(`Participant ${participant.identity} joined room ${roomName}`);
  }
}
