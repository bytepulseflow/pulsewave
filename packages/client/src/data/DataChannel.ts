/**
 * DataChannel - Wrapper for WebRTC data channels
 */

import type { DataChannelEvents } from '../types';

/**
 * DataChannel wrapper class
 */
export class DataChannel {
  /** Data channel instance */
  public readonly channel: RTCDataChannel;

  /** Channel label */
  public readonly label: string;

  /** Event listeners */
  private listeners: Map<keyof DataChannelEvents, Set<(data: unknown) => void>> = new Map();

  constructor(channel: RTCDataChannel) {
    this.channel = channel;
    this.label = channel.label;

    // Set up event listeners
    this.channel.addEventListener('open', this.handleOpen);
    this.channel.addEventListener('message', this.handleMessage);
    this.channel.addEventListener('close', this.handleClose);
    this.channel.addEventListener('error', this.handleError);
  }

  /**
   * Get channel state
   */
  get state(): RTCDataChannelState {
    return this.channel.readyState;
  }

  /**
   * Get channel ID
   */
  get id(): number | null {
    return this.channel.id;
  }

  /**
   * Get channel protocol
   */
  get protocol(): string {
    return this.channel.protocol;
  }

  /**
   * Get current buffered amount
   */
  get bufferedAmount(): number {
    return this.channel.bufferedAmount;
  }

  /**
   * Send data through the channel
   */
  send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.channel.send(data as any);
  }

  /**
   * Close the channel
   */
  close(): void {
    this.channel.removeEventListener('open', this.handleOpen);
    this.channel.removeEventListener('message', this.handleMessage);
    this.channel.removeEventListener('close', this.handleClose);
    this.channel.removeEventListener('error', this.handleError);
    this.channel.close();
  }

  /**
   * Add event listener
   */
  on<K extends keyof DataChannelEvents>(event: K, listener: DataChannelEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as (data: unknown) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof DataChannelEvents>(event: K, listener: DataChannelEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as (data: unknown) => void);
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof DataChannelEvents>(event: K, data?: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Handle open event
   */
  private handleOpen = (): void => {
    this.emit('open');
  };

  /**
   * Handle message event
   */
  private handleMessage = (event: MessageEvent): void => {
    this.emit('message', event.data);
  };

  /**
   * Handle close event
   */
  private handleClose = (): void => {
    this.emit('close');
  };

  /**
   * Handle error event
   */
  private handleError = (event: Event): void => {
    const error = new Error(`Data channel error: ${event}`);
    this.emit('error', error);
  };

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}
