/**
 * Data provider types for different data transmission strategies
 */

import type { DataPacket } from './room.types';

/**
 * Data provider type enum
 */
export enum DataProviderType {
  /** WebSocket signaling - data goes through server */
  WebSocket = 'websocket',
  /** WebRTC data channels - peer-to-peer via mediasoup */
  WebRTC = 'webrtc',
}

/**
 * Data channel kind
 */
export enum DataChannelKind {
  /** Reliable - ordered delivery, guaranteed */
  Reliable = 'reliable',
  /** Lossy - unordered, may drop packets for real-time data */
  Lossy = 'lossy',
}

/**
 * Data provider configuration
 */
export interface DataProviderConfig {
  /** Provider type */
  type: DataProviderType;
  /** Maximum message size in bytes (default: 16KB) */
  maxMessageSize?: number;
  /** Ordered delivery (only for WebRTC) */
  ordered?: boolean;
  /** Maximum packet lifetime in ms (only for WebRTC lossy) */
  maxPacketLifeTime?: number;
  /** Maximum retransmits (only for WebRTC lossy) */
  maxRetransmits?: number;
}

/**
 * Data provider events
 */
export interface DataProviderEvents {
  /** Data received */
  'data-received': (packet: DataPacket, participantSid: string) => void;
  /** Provider connected */
  connected: () => void;
  /** Provider disconnected */
  disconnected: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

/**
 * Data provider interface - strategy pattern
 */
export interface DataProvider {
  /** Provider type */
  readonly type: DataProviderType;
  /** Configuration */
  readonly config: DataProviderConfig;

  /**
   * Initialize the data provider
   */
  initialize(): Promise<void>;

  /**
   * Send data
   * @param data - The data to send
   * @param kind - Channel kind (reliable or lossy)
   */
  send(data: unknown, kind: DataChannelKind): Promise<void>;

  /**
   * Close the data provider
   */
  close(): Promise<void>;

  /**
   * Check if provider is ready
   */
  isReady(): boolean;

  /**
   * Add event listener
   */
  on<K extends keyof DataProviderEvents>(event: K, listener: DataProviderEvents[K]): void;

  /**
   * Remove event listener
   */
  off<K extends keyof DataProviderEvents>(event: K, listener: DataProviderEvents[K]): void;

  /**
   * Remove all listeners
   */
  removeAllListeners(): void;
}
