/**
 * SignalingClient - Generic signaling client for intent-based communication
 *
 * This client provides intent-based messaging for the application layer,
 * abstracting away the underlying transport implementation (WebSocket, Socket.io, etc.).
 * It handles connection management, message routing, and event emission.
 */

import type { SignalingTransport, SignalingTransportOptions } from './transport/SignalingTransport';
import { WebSocketTransport } from './transport/WebSocketTransport';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('signaling-client');

/**
 * Signaling client options
 */
export interface SignalingClientOptions {
  /**
   * Transport options
   */
  transport: SignalingTransportOptions;

  /**
   * Custom transport implementation (optional)
   * If not provided, WebSocketTransport will be used
   */
  transportImpl?: new (options: SignalingTransportOptions) => SignalingTransport;
}

/**
 * Signaling client state
 */
export type SignalingClientState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Event listener for state changes
 */
export type StateChangeListener = (state: SignalingClientState) => void;

/**
 * Event listener for incoming messages
 */
export type MessageListener = (message: Record<string, unknown>) => void;

/**
 * Event listener for errors
 */
export type ErrorListener = (error: Error) => void;

/**
 * SignalingClient - Generic signaling client for intent-based communication
 */
export class SignalingClient {
  private transport: SignalingTransport;
  private messageListeners: Set<MessageListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private _state: SignalingClientState = 'disconnected';

  constructor(options: SignalingClientOptions) {
    // Use custom transport implementation or default to WebSocket
    const TransportImpl = options.transportImpl ?? WebSocketTransport;
    this.transport = new TransportImpl(options.transport);

    // Wire up transport events
    this.transport.onStateChange(this.handleTransportStateChange.bind(this));
    this.transport.onMessage(this.handleTransportMessage.bind(this));
    this.transport.onError(this.handleTransportError.bind(this));
  }

  /**
   * Get current client state
   */
  get state(): SignalingClientState {
    return this._state;
  }

  /**
   * Connect to the signaling server
   */
  async connect(): Promise<void> {
    if (this._state === 'connected' || this._state === 'connecting') {
      logger.debug('Already connected or connecting');
      return;
    }

    logger.info('Connecting to signaling server...');
    await this.transport.connect();
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    logger.info('Disconnecting from signaling server...');
    this.transport.disconnect();
  }

  /**
   * Send a message to the signaling server
   */
  send(message: Record<string, unknown>): void {
    logger.debug('Sending message:', { type: message.type });
    this.transport.send(message);
  }

  /**
   * Register a listener for state changes
   */
  onStateChange(listener: StateChangeListener): void {
    this.stateListeners.add(listener);
  }

  /**
   * Unregister a state change listener
   */
  offStateChange(listener: StateChangeListener): void {
    this.stateListeners.delete(listener);
  }

  /**
   * Register a listener for incoming messages
   */
  onMessage(listener: MessageListener): void {
    this.messageListeners.add(listener);
  }

  /**
   * Unregister a message listener
   */
  offMessage(listener: MessageListener): void {
    this.messageListeners.delete(listener);
  }

  /**
   * Register a listener for errors
   */
  onError(listener: ErrorListener): void {
    this.errorListeners.add(listener);
  }

  /**
   * Unregister an error listener
   */
  offError(listener: ErrorListener): void {
    this.errorListeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.messageListeners.clear();
    this.stateListeners.clear();
    this.errorListeners.clear();
  }

  /**
   * Handle transport state change
   */
  private handleTransportStateChange(state: SignalingClientState): void {
    this._state = state;
    logger.debug('State changed:', { state });
    this.notifyStateListeners(state);
  }

  /**
   * Handle incoming message from transport
   */
  private handleTransportMessage(message: Record<string, unknown>): void {
    logger.debug('Message received:', { type: message.type });
    this.notifyMessageListeners(message);
  }

  /**
   * Handle transport error
   */
  private handleTransportError(error: Error): void {
    logger.error('Transport error:', { error });
    this.notifyErrorListeners(error);
  }

  /**
   * Notify all state change listeners
   */
  private notifyStateListeners(state: SignalingClientState): void {
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in state change listener:', { error });
      }
    });
  }

  /**
   * Notify all message listeners
   */
  private notifyMessageListeners(message: Record<string, unknown>): void {
    this.messageListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        logger.error('Error in message listener:', { error });
      }
    });
  }

  /**
   * Notify all error listeners
   */
  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        logger.error('Error in error listener:', { error: err });
      }
    });
  }
}
