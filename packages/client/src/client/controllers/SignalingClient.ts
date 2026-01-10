/**
 * SignalingClient - Handles WebSocket signaling message dispatch
 *
 * Manages sending and receiving signaling messages through the WebSocket connection.
 */

import type { RoomClientOptions } from '../../types';
import { handlerRegistry } from '../handlers';

/**
 * SignalingClient - Handles WebSocket signaling message dispatch
 */
export class SignalingClient {
  private client: unknown = null;

  constructor(
    private readonly options: RoomClientOptions,
    private readonly sendFn: (message: Record<string, unknown>) => void
  ) {}

  /**
   * Set the client for handler context
   */
  setClient(client: unknown): void {
    this.client = client;
  }

  /**
   * Send join message
   */
  sendJoin(): void {
    this.sendFn({
      type: 'join',
      room: this.options.room,
      token: this.options.token,
    });
  }

  /**
   * Send leave message
   */
  sendLeave(): void {
    this.sendFn({
      type: 'leave',
    });
  }

  /**
   * Send data message
   */
  sendData(data: unknown, kind: 'reliable' | 'lossy' = 'reliable'): void {
    this.sendFn({
      type: 'data',
      kind,
      payload: data,
    });
  }

  /**
   * Handle incoming message
   */
  handleMessage(message: Record<string, unknown>): void {
    // Handle message through registry
    handlerRegistry.handle({ client: this.client as never }, message);
  }

  /**
   * Send custom message
   */
  send(message: Record<string, unknown>): void {
    this.sendFn(message);
  }
}
