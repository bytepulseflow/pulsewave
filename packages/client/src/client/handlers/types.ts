/**
 * Types for client message handlers
 */

import type { RoomClient } from '../RoomClient';
import type { RoomEvents } from '../../types';
import type { ServerMessage } from '@bytepulse/pulsewave-shared';

/**
 * Context passed to message handlers
 */
export interface HandlerContext {
  client: RoomClient;
}

/**
 * Base interface for message handlers
 */
export interface MessageHandler {
  type: string;
  handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void;
}

/**
 * Emit function type
 */
export type EmitFunction = <K extends keyof RoomEvents>(event: K, data?: unknown) => void;
