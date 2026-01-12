/**
 * Call message handler
 */

import { CLIENT_EVENTS, ErrorCode, CallState } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CallMessage } from '@bytepulse/pulsewave-shared';
import type { Room } from '../../sfu/Room';
import type { RoomCallInfo } from '../../sfu/Room';
import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:call');

export class CallHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.CALL;

  public async handle(context: HandlerContext, message: CallMessage): Promise<void> {
    const { targetParticipantSid, metadata } = message;

    // Validate participant is in a room
    if (!this.validateParticipant(context)) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Not in a room');
      return;
    }

    const room = this.getRoom(context);
    const caller = this.getParticipant(context);

    if (!room || !caller) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Invalid room or participant');
      return;
    }

    // Get target participant
    const target = room.getParticipant(targetParticipantSid);
    if (!target) {
      this.sendError(context.ws, ErrorCode.ParticipantNotFound, 'Target participant not found');
      return;
    }

    // Check if target is the caller
    if (target.sid === caller.sid) {
      this.sendError(context.ws, ErrorCode.InvalidRequest, 'Cannot call yourself');
      return;
    }

    // Check if there's already a pending call between these participants
    const existingCall = this.getCallBetweenParticipants(room, caller.sid, target.sid);
    if (existingCall && existingCall.state === CallState.Pending) {
      this.sendError(context.ws, ErrorCode.CallAlreadyExists, 'Call already in progress');
      return;
    }

    // Generate call ID
    const callId = uuidv4();

    // Create call info
    const callInfo: RoomCallInfo = {
      callId,
      callerSid: caller.sid,
      targetSid: target.sid,
      state: 'pending',
      startTime: Date.now(),
      metadata,
    };

    // Store call in room
    room.addCall(callInfo);

    // Get target's WebSocket connection
    const targetWs = context.connections.get(target.socketId);
    if (!targetWs) {
      this.sendError(context.ws, ErrorCode.ParticipantNotFound, 'Target participant not connected');
      room.removeCall(callId);
      return;
    }

    // Send call received message to target
    this.send(targetWs, {
      type: 'call_received',
      callId,
      caller: caller.getInfo(),
      metadata,
    });

    logger.info(`Call initiated: ${caller.identity} -> ${target.identity} (callId: ${callId})`);
  }

  /**
   * Get call between two participants
   */
  private getCallBetweenParticipants(
    room: Room,
    sid1: string,
    sid2: string
  ): RoomCallInfo | undefined {
    return room.getCallBetweenParticipants(sid1, sid2);
  }
}
