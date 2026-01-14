/**
 * ConsumerManager - Manages media track consumers
 */

import { types } from 'mediasoup-client';
import type { RtpParameters } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('consumer-manager');

/**
 * ConsumerManager options
 */
export interface ConsumerManagerOptions {
  sendFn: (message: Record<string, unknown>) => void;
  onMessage: (handler: (data: unknown) => void) => void;
  offMessage: (handler: (data: unknown) => void) => void;
  getRecvTransport: () => types.Transport | null;
  getDevice: () => types.Device | null;
}

/**
 * ConsumerManager - Manages media track consumers
 */
export class ConsumerManager {
  private consumers: Map<string, types.Consumer> = new Map();
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;
  private getRecvTransport: () => types.Transport | null;
  private getDevice: () => types.Device | null;

  constructor(options: ConsumerManagerOptions) {
    this.sendFn = options.sendFn;
    this.onMessage = options.onMessage;
    this.offMessage = options.offMessage;
    this.getRecvTransport = options.getRecvTransport;
    this.getDevice = options.getDevice;
  }

  /**
   * Subscribe to a track
   */
  async subscribeToTrack(producerId: string): Promise<types.Consumer> {
    const transport = this.getRecvTransport();
    if (!transport) {
      throw new Error('Receive transport not created');
    }

    const device = this.getDevice();
    if (!device) {
      throw new Error('Device not initialized');
    }

    const consumerInfo = await this.requestSubscribe(transport.id, producerId);

    const consumer = await transport.consume({
      id: consumerInfo.id,
      producerId,
      kind: consumerInfo.kind as 'audio' | 'video',
      rtpParameters: consumerInfo.rtpParameters as types.RtpParameters,
    });

    this.consumers.set(consumer.id, consumer);

    // Resume the consumer
    await this.resumeConsumer(consumer.id);

    logger.info(`Track subscribed: ${consumer.id} (${consumer.kind})`);
    return consumer;
  }

  /**
   * Request to subscribe to a track
   */
  private async requestSubscribe(
    transportId: string,
    producerId: string
  ): Promise<{ id: string; kind: string; rtpParameters: RtpParameters; trackSid: string }> {
    const device = this.getDevice();
    if (!device) {
      throw new Error('Device not initialized');
    }

    const deviceRtpCapabilities = device.rtpCapabilities;

    return new Promise((resolve) => {
      const message = {
        type: 'subscribe',
        transportId,
        producerId,
        rtpCapabilities: deviceRtpCapabilities || {},
      };

      const handler = (data: unknown) => {
        const msg = data as Record<string, unknown>;
        if (msg.type === 'track_subscribed' && msg.producerId === producerId) {
          this.offMessage(handler);
          resolve(msg as never);
        }
      };

      this.onMessage(handler);
      this.sendFn(message);

      // Timeout after 10 seconds
      setTimeout(() => {
        this.offMessage(handler);
        // reject(new Error('Subscribe timeout'));
      }, 10000);
    });
  }

  /**
   * Unsubscribe from a track
   */
  async unsubscribeFromTrack(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);

      this.sendFn({
        type: 'unsubscribe',
        consumerId,
      });

      logger.info(`Track unsubscribed: ${consumerId}`);
    }
  }

  /**
   * Resume a consumer
   */
  async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      await consumer.resume();

      this.sendFn({
        type: 'resume_consumer',
        consumerId,
      });

      logger.info(`Consumer resumed: ${consumerId}`);
    }
  }

  /**
   * Get all consumers
   */
  getConsumers(): types.Consumer[] {
    return Array.from(this.consumers.values());
  }

  /**
   * Get a consumer by ID
   */
  getConsumer(id: string): types.Consumer | undefined {
    return this.consumers.get(id);
  }

  /**
   * Close all consumers
   */
  close(): void {
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();
    logger.info('Consumer manager closed');
  }
}
