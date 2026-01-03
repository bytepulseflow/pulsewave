/**
 * ConnectionController - Manages WebSocket connection lifecycle
 *
 * Handles WebSocket connection, disconnection, and reconnection logic.
 */

import type { RoomClientOptions } from '../../types';
import { ConnectionState } from '@bytepulse/pulsewave-shared';

/**
 * Connection state listener type
 */
type ConnectionStateListener = (state: ConnectionState) => void;

/**
 * Connection error listener type
 */
type ConnectionErrorListener = (error: Error) => void;

/**
 * Message listener type
 */
type MessageListener = (message: unknown) => void;

/**
 * ConnectionController - Manages WebSocket connection lifecycle
 */
export class ConnectionController {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private pendingMessages: Record<string, unknown>[] = [];

  private state: ConnectionState = ConnectionState.Disconnected;
  private stateListeners: Set<ConnectionStateListener> = new Set();
  private errorListeners: Set<ConnectionErrorListener> = new Set();
  private messageListener: MessageListener | null = null;

  constructor(private readonly options: RoomClientOptions) {}

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.state === ConnectionState.Connected || this.state === ConnectionState.Reconnecting) {
      return;
    }

    // Set state to Reconnecting while connecting
    this.setState(ConnectionState.Reconnecting);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState(ConnectionState.Connected);

        // Send pending messages
        while (this.pendingMessages.length > 0) {
          const message = this.pendingMessages.shift();
          if (message) {
            this.send(message);
          }
        }

        resolve();
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onerror = (error) => {
        const err = error instanceof Error ? error : new Error('WebSocket error');
        this.notifyError(err);
        reject(err);
      };

      this.ws.onmessage = (event) => {
        if (this.messageListener) {
          this.messageListener(JSON.parse(event.data));
        }
      };
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.pendingMessages = [];
    this.setState(ConnectionState.Disconnected);
  }

  /**
   * Send message via WebSocket
   */
  send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.pendingMessages.push(message);
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.Connected;
  }

  /**
   * Add state listener
   */
  onStateChange(listener: ConnectionStateListener): void {
    this.stateListeners.add(listener);
  }

  /**
   * Remove state listener
   */
  offStateChange(listener: ConnectionStateListener): void {
    this.stateListeners.delete(listener);
  }

  /**
   * Add error listener
   */
  onError(listener: ConnectionErrorListener): void {
    this.errorListeners.add(listener);
  }

  /**
   * Remove error listener
   */
  offError(listener: ConnectionErrorListener): void {
    this.errorListeners.delete(listener);
  }

  /**
   * Set message listener
   */
  setMessageListener(listener: MessageListener): void {
    this.messageListener = listener;
  }

  /**
   * Clear message listener
   */
  clearMessageListener(): void {
    this.messageListener = null;
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(): void {
    this.setState(ConnectionState.Disconnected);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.setState(ConnectionState.Reconnecting);

      setTimeout(() => {
        this.connect().catch((error) => {
          this.notifyError(error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Notify error listeners
   */
  private notifyError(error: Error): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Clear all listeners
   */
  clearListeners(): void {
    this.stateListeners.clear();
    this.errorListeners.clear();
    this.messageListener = null;
  }
}
