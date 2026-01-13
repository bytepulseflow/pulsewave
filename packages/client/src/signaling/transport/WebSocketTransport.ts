/**
 * WebSocketTransport - WebSocket implementation of SignalingTransport
 *
 * This is the first implementation of the SignalingTransport interface,
 * using native WebSocket API for signaling communication.
 */

import type {
  SignalingTransport,
  SignalingTransportOptions,
  SignalingTransportState,
  StateChangeListener,
  MessageListener,
  ErrorListener,
  SignalingMessage,
} from './SignalingTransport';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('websocket-transport');

/**
 * WebSocketTransport - WebSocket implementation of SignalingTransport
 */
export class WebSocketTransport implements SignalingTransport {
  private ws: WebSocket | null = null;
  private _state: SignalingTransportState = 'disconnected';
  private stateListeners: Set<StateChangeListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: SignalingTransportOptions) {}

  /**
   * Get current transport state
   */
  get state(): SignalingTransportState {
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

    this.setState('connecting');
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.url);

        // Set connection timeout
        const timeout = this.options.connectTimeout ?? 10000;
        this.connectTimer = setTimeout(() => {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }, timeout);

        this.ws.onopen = () => {
          if (this.connectTimer) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
          }
          this.setState('connected');
          this.reconnectAttempts = 0;
          logger.info('WebSocket connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SignalingMessage;
            this.notifyMessageListeners(message);
          } catch (error) {
            logger.error('Failed to parse message:', { error });
          }
        };

        this.ws.onerror = (event) => {
          logger.error('WebSocket error:', { event });
          this.notifyErrorListeners(new Error('WebSocket error'));
        };

        this.ws.onclose = () => {
          if (this.connectTimer) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
          }

          if (this._state === 'connected') {
            // Unexpected disconnect, try to reconnect
            this.handleReconnect();
          } else {
            this.setState('disconnected');
          }
        };
      } catch (error) {
        this.setState('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    // Clear any pending timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    logger.info('WebSocket disconnected');
  }

  /**
   * Send a message to the signaling server
   */
  send(message: SignalingMessage): void {
    if (this._state !== 'connected' || !this.ws) {
      throw new Error('Cannot send message: not connected');
    }

    try {
      this.ws.send(JSON.stringify(message));
      logger.debug('Message sent:', { type: message.type });
    } catch (error) {
      logger.error('Failed to send message:', { error });
      throw error;
    }
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
    this.stateListeners.clear();
    this.messageListeners.clear();
    this.errorListeners.clear();
  }

  /**
   * Set transport state and notify listeners
   */
  private setState(state: SignalingTransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.notifyStateListeners(state);
    }
  }

  /**
   * Notify all state change listeners
   */
  private notifyStateListeners(state: SignalingTransportState): void {
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
  private notifyMessageListeners(message: SignalingMessage): void {
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

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    const maxAttempts = this.options.reconnectAttempts ?? 5;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setState('error');
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.setState('reconnecting');

    const baseDelay = this.options.reconnectDelay ?? 1000;
    const maxDelay = this.options.maxReconnectDelay ?? 30000;
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection failed:', { error });
      });
    }, delay);
  }
}
