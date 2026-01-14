/**
 * TransportConnectionManager - Manages transport connection state and callbacks
 */

import { types } from 'mediasoup-client';
import type { DtlsParameters } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('transport-connection-manager');

/**
 * TransportConnectionManager options
 */
export interface TransportConnectionManagerOptions {
  sendFn: (message: Record<string, unknown>) => void;
  onMessage: (handler: (data: unknown) => void) => void;
  offMessage: (handler: (data: unknown) => void) => void;
}

/**
 * TransportConnectionManager - Manages transport connection state
 */
export class TransportConnectionManager {
  private sendTransportConnected = false;
  private recvTransportConnected = false;
  private sendTransportConnectPromise: Promise<void> | null = null;
  private recvTransportConnectPromise: Promise<void> | null = null;
  private sendTransportConnectResolve: (() => void) | null = null;
  private recvTransportConnectResolve: (() => void) | null = null;
  private onTransportsConnectedCallbacks: Set<() => void> = new Set();
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;

  constructor(options: TransportConnectionManagerOptions) {
    this.sendFn = options.sendFn;
    this.onMessage = options.onMessage;
    this.offMessage = options.offMessage;
  }

  /**
   * Setup transport event listeners
   */
  setupTransportListeners(
    transport: types.Transport,
    direction: 'send' | 'recv',
    onProduce?: (params: {
      kind: string;
      rtpParameters: unknown;
      appData?: Record<string, unknown>;
    }) => Promise<{ id: string }>,
    onProduceData?: (params: {
      sctpStreamParameters: unknown;
      label?: string;
      protocol?: string;
      appData: Record<string, unknown>;
    }) => Promise<{ id: string }>
  ): void {
    transport.on(
      'connect',
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
        errback: (error: Error) => void
      ) => {
        // Send connect message to server
        this.sendFn({
          type: 'connect_transport',
          transportId: transport.id,
          dtlsParameters,
        });

        // Set up one-time listener for connect confirmation
        const connectHandler = (data: unknown) => {
          const msg = data as Record<string, unknown>;
          if (msg.type === 'transport_connected' && msg.transportId === transport.id) {
            this.offMessage(connectHandler);

            // Mark transport as connected
            if (direction === 'send') {
              this.sendTransportConnected = true;
              this.sendTransportConnectResolve?.();
            } else {
              this.recvTransportConnected = true;
              this.recvTransportConnectResolve?.();
            }

            // Check if both transports are connected
            this.checkTransportsConnected();

            // Call the callback to signal successful connection
            callback();
          }
        };

        this.onMessage(connectHandler);

        // Set up error handler
        const errorHandler = (data: unknown) => {
          const msg = data as Record<string, unknown>;
          if (msg.type === 'error' && msg.transportId === transport.id) {
            this.offMessage(errorHandler);
            errback(new Error((msg.error as string) || 'Transport connection failed'));
          }
        };

        this.onMessage(errorHandler);
      }
    );

    if (direction === 'send') {
      transport.on(
        'produce',
        async (
          {
            kind,
            rtpParameters,
            appData,
          }: { kind: string; rtpParameters: unknown; appData?: Record<string, unknown> },
          callback: (data: { id: string }) => void,
          errback: (error: Error) => void
        ) => {
          try {
            if (onProduce) {
              const response = await onProduce({ kind, rtpParameters, appData });
              callback({ id: response.id });
            }
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      // Handle producedata event
      transport.on(
        'producedata',
        async (
          {
            sctpStreamParameters,
            label,
            protocol,
            appData,
          }: {
            sctpStreamParameters: unknown;
            label?: string;
            protocol?: string;
            appData: Record<string, unknown>;
          },
          callback: (data: { id: string }) => void,
          errback: (error: Error) => void
        ) => {
          try {
            if (onProduceData) {
              const response = await onProduceData({
                sctpStreamParameters,
                label,
                protocol,
                appData,
              });
              callback({ id: response.id });
            }
          } catch (error) {
            errback(error as Error);
          }
        }
      );
    }
  }

  /**
   * Check if both transports are connected and trigger callbacks
   */
  private checkTransportsConnected(): void {
    if (this.sendTransportConnected && this.recvTransportConnected) {
      logger.info('Both transports connected, triggering callbacks');
      this.onTransportsConnectedCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          logger.error('Error in transports connected callback', { error });
        }
      });
    }
  }

  /**
   * Register a callback to be called when both transports are connected
   */
  onTransportsConnected(callback: () => void): void {
    this.onTransportsConnectedCallbacks.add(callback);

    // If both transports are already connected, call the callback immediately
    if (this.sendTransportConnected && this.recvTransportConnected) {
      callback();
    }
  }

  /**
   * Unregister a transports connected callback
   */
  offTransportsConnected(callback: () => void): void {
    this.onTransportsConnectedCallbacks.delete(callback);
  }

  /**
   * Wait for both transports to be connected
   */
  async waitForTransportsConnected(): Promise<void> {
    if (this.sendTransportConnected && this.recvTransportConnected) {
      return;
    }

    // Create promises if not already created
    if (!this.sendTransportConnectPromise) {
      this.sendTransportConnectPromise = new Promise((resolve) => {
        this.sendTransportConnectResolve = resolve;
      });
    }

    if (!this.recvTransportConnectPromise) {
      this.recvTransportConnectPromise = new Promise((resolve) => {
        this.recvTransportConnectResolve = resolve;
      });
    }

    await Promise.all([this.sendTransportConnectPromise, this.recvTransportConnectPromise]);
  }

  /**
   * Check if both transports are connected
   */
  areTransportsConnected(): boolean {
    return this.sendTransportConnected && this.recvTransportConnected;
  }

  /**
   * Reset connection state
   */
  reset(): void {
    this.sendTransportConnected = false;
    this.recvTransportConnected = false;
    this.sendTransportConnectPromise = null;
    this.recvTransportConnectPromise = null;
    this.sendTransportConnectResolve = null;
    this.recvTransportConnectResolve = null;
    this.onTransportsConnectedCallbacks.clear();
    logger.info('Transport connection state reset');
  }

  /**
   * Close the manager
   */
  close(): void {
    this.reset();
    logger.info('Transport connection manager closed');
  }
}
