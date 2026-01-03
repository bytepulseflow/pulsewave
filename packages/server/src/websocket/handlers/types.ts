/**
 * Types for WebSocket message handlers
 */

import type { WebSocket } from 'ws';
import type { RoomManager } from '../../sfu';
import type { RedisManager } from '../../redis';
import type { JwtConfig } from '../../config';
import type { Room } from '../../sfu/Room';
import type { ServerMessage, ClientMessage } from '@bytepulse/pulsewave-shared';

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
  room: Room,
  message: ServerMessage,
  excludeSocketId?: string
) => void;

/**
 * Send helper function type
 */
export type SendFunction = (ws: WebSocketConnection, message: ServerMessage) => void;

/**
 * Send error helper function type
 */
export type SendErrorFunction = (ws: WebSocketConnection, code: number, message: string) => void;

/**
 * Context passed to message handlers
 */
export interface HandlerContext {
  ws: WebSocketConnection;
  roomManager: RoomManager;
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
  handle(context: HandlerContext, message: ClientMessage): Promise<void>;
}

/**
 * Result of handler execution
 */
export interface HandlerResult {
  success: boolean;
  error?: Error;
}
