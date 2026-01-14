/**
 * Types for WebSocket message handlers
 */

import type { WebSocket } from 'ws';
import type { RedisManager } from '../../../redis';
import type { JwtConfig } from '../../../config';
import type { ClientIntent, ServerResponse } from '@bytepulse/pulsewave-shared';
import type { RoomManager as ApplicationRoomManager } from '../../../application';
import type { CallManager } from '../../../application';
import type { AdapterManager } from '../../../adapter';
import type { ApplicationRoom } from '../../../application/services/types';

/**
 * Extended WebSocket connection with additional data
 */
export interface WebSocketConnection extends WebSocket {
  socketId: string;
  participantSid?: string;
  roomSid?: string;
}

/**
 * Broadcast helper function type
 */
export type BroadcastFunction = (
  room: ApplicationRoom,
  message: ServerResponse,
  excludeSocketId?: string
) => void;

/**
 * Send helper function type
 */
export type SendFunction = (ws: WebSocketConnection, message: ServerResponse) => void;

/**
 * Send error helper function type
 */
export type SendErrorFunction = (ws: WebSocketConnection, code: number, message: string) => void;

/**
 * Context passed to message handlers
 */
export interface HandlerContext {
  ws: WebSocketConnection;
  // Application Layer
  applicationRoomManager: ApplicationRoomManager;
  callManager: CallManager;
  // Adapter Layer
  adapterManager: AdapterManager;
  redisManager: RedisManager | null;
  jwtConfig: JwtConfig;
  connections: Map<string, WebSocketConnection>;
  broadcast: BroadcastFunction;
}

/**
 * Base interface for message handlers
 */
export interface MessageHandler {
  type: string;
  handle(context: HandlerContext, message: ClientIntent): Promise<void>;
}

/**
 * Result of handler execution
 */
export interface HandlerResult {
  success: boolean;
  error?: Error;
}
