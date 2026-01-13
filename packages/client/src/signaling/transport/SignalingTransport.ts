/**
 * SignalingTransport - Generic interface for signaling transport backends
 *
 * This interface defines the contract for all signaling transport implementations
 * (WebSocket, Socket.io, etc.). It provides a unified API for the signaling layer
 * to communicate with the server regardless of the underlying transport.
 */

/**
 * Signaling transport state
 */
export type SignalingTransportState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Signaling message (any JSON-serializable object)
 */
export type SignalingMessage = Record<string, unknown>;

/**
 * Event listener for transport state changes
 */
export type StateChangeListener = (state: SignalingTransportState) => void;

/**
 * Event listener for incoming messages
 */
export type MessageListener = (message: SignalingMessage) => void;

/**
 * Event listener for errors
 */
export type ErrorListener = (error: Error) => void;

/**
 * Signaling transport options
 */
export interface SignalingTransportOptions {
  /**
   * URL to connect to
   */
  url: string;

  /**
   * Connection timeout in milliseconds
   * @default 10000
   */
  connectTimeout?: number;

  /**
   * Reconnection attempts
   * @default 5
   */
  reconnectAttempts?: number;

  /**
   * Reconnection delay in milliseconds
   * @default 1000
   */
  reconnectDelay?: number;

  /**
   * Maximum reconnection delay in milliseconds
   * @default 30000
   */
  maxReconnectDelay?: number;
}

/**
 * SignalingTransport - Interface for signaling transport implementations
 */
export interface SignalingTransport {
  /**
   * Current transport state
   */
  readonly state: SignalingTransportState;

  /**
   * Connect to the signaling server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void;

  /**
   * Send a message to the signaling server
   */
  send(message: SignalingMessage): void;

  /**
   * Register a listener for state changes
   */
  onStateChange(listener: StateChangeListener): void;

  /**
   * Unregister a state change listener
   */
  offStateChange(listener: StateChangeListener): void;

  /**
   * Register a listener for incoming messages
   */
  onMessage(listener: MessageListener): void;

  /**
   * Unregister a message listener
   */
  offMessage(listener: MessageListener): void;

  /**
   * Register a listener for errors
   */
  onError(listener: ErrorListener): void;

  /**
   * Unregister an error listener
   */
  offError(listener: ErrorListener): void;

  /**
   * Remove all listeners
   */
  removeAllListeners(): void;
}
