/**
 * WebSocketDataProvider - Data transmission via WebSocket signaling
 *
 * This provider sends data through the WebSocket signaling layer.
 * Data is routed through the server to all participants.
 */

import type {
  DataProvider,
  DataProviderConfig,
  DataProviderEvents,
  DataChannelKind,
} from '@bytepulse/pulsewave-shared';
import { DataProviderType } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('data-provider:websocket');

/**
 * WebSocketDataProvider - sends data via WebSocket signaling
 */
export class WebSocketDataProvider implements DataProvider {
  public readonly type = DataProviderType.WebSocket;
  public readonly config: DataProviderConfig;

  private listeners: Map<keyof DataProviderEvents, Set<(...args: unknown[]) => void>> = new Map();
  private sendFn: (data: unknown, kind: DataChannelKind) => Promise<void>;
  private _isReady = false;

  constructor(
    sendFn: (data: unknown, kind: DataChannelKind) => Promise<void>,
    config?: Partial<DataProviderConfig>
  ) {
    this.config = {
      type: DataProviderType.WebSocket,
      maxMessageSize: config?.maxMessageSize || 16384, // 16KB default
      ...config,
    };
    this.sendFn = sendFn;
  }

  /**
   * Initialize the WebSocket data provider
   */
  async initialize(): Promise<void> {
    this._isReady = true;
    this.emit('connected');
    logger.info('WebSocket data provider initialized');
  }

  /**
   * Send data via WebSocket signaling
   */
  async send(data: unknown, kind: DataChannelKind): Promise<void> {
    if (!this._isReady) {
      throw new Error('WebSocket data provider not ready');
    }

    // Check message size
    const dataSize = this.getDataSize(data);
    if (this.config.maxMessageSize && dataSize > this.config.maxMessageSize) {
      throw new Error(`Message size ${dataSize} exceeds maximum ${this.config.maxMessageSize}`);
    }

    try {
      await this.sendFn(data, kind);
      logger.debug(`Sent data via WebSocket: ${kind}, size: ${dataSize}`);
    } catch (error) {
      logger.error('Failed to send data via WebSocket', { error });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Close the WebSocket data provider
   */
  async close(): Promise<void> {
    this._isReady = false;
    this.removeAllListeners();
    this.emit('disconnected');
    logger.info('WebSocket data provider closed');
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Add event listener
   */
  on<K extends keyof DataProviderEvents>(event: K, listener: DataProviderEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(listener as (...args: unknown[]) => void);
    }
  }

  /**
   * Remove event listener
   */
  off<K extends keyof DataProviderEvents>(event: K, listener: DataProviderEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as (...args: unknown[]) => void);
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof DataProviderEvents>(
    event: K,
    ...args: Parameters<DataProviderEvents[K]>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          logger.error(`Error in ${event} listener`, { error });
        }
      });
    }
  }

  /**
   * Calculate data size in bytes
   */
  private getDataSize(data: unknown): number {
    if (typeof data === 'string') {
      return new Blob([data]).size;
    }
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    if (typeof data === 'object' && data !== null) {
      return new Blob([JSON.stringify(data)]).size;
    }
    return 0;
  }
}
