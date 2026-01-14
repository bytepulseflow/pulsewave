/**
 * ProducerManager - Manages media track producers
 */

import { types } from 'mediasoup-client';
import type { RtpParameters } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('producer-manager');

/**
 * ProducerManager options
 */
export interface ProducerManagerOptions {
  sendFn: (message: Record<string, unknown>) => void;
  onMessage: (handler: (data: unknown) => void) => void;
  offMessage: (handler: (data: unknown) => void) => void;
  getSendTransport: () => types.Transport | null;
}

/**
 * ProducerManager - Manages media track producers
 */
export class ProducerManager {
  private producers: Map<string, types.Producer> = new Map();
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;
  private getSendTransport: () => types.Transport | null;

  constructor(options: ProducerManagerOptions) {
    this.sendFn = options.sendFn;
    this.onMessage = options.onMessage;
    this.offMessage = options.offMessage;
    this.getSendTransport = options.getSendTransport;
  }

  /**
   * Publish a track
   */
  async publishTrack(
    track: MediaStreamTrack,
    options: { source?: string } = {}
  ): Promise<types.Producer> {
    const transport = this.getSendTransport();
    if (!transport) {
      throw new Error('Send transport not created');
    }

    const producer = await transport.produce({
      track,
      encodings: track.kind === 'video' ? [{ maxBitrate: 1000000 }] : undefined,
      codecOptions: {
        videoGoogleStartBitrate: 1000,
      },
      appData: {
        source: options.source || (track.kind === 'audio' ? 'microphone' : 'camera'),
      },
    });

    this.producers.set(producer.id, producer);

    producer.on('trackended', () => {
      this.unpublishTrack(producer.id);
    });

    logger.info(`Track published: ${producer.id} (${track.kind})`);
    return producer;
  }

  /**
   * Unpublish a track
   */
  async unpublishTrack(producerId: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);

      this.sendFn({
        type: 'unpublish',
        producerId,
        trackSid: producerId,
      });

      logger.info(`Track unpublished: ${producerId}`);
    }
  }

  /**
   * Request to produce a track
   */
  async requestProduce(
    transportId: string,
    kind: string,
    rtpParameters: RtpParameters,
    appData?: Record<string, unknown>
  ): Promise<{ id: string; trackSid: string }> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'publish',
        transportId,
        kind,
        rtpParameters,
        appData,
      };

      const handler = (data: unknown) => {
        const msg = data as Record<string, unknown>;
        if (msg.type === 'track_published' && msg.id) {
          this.offMessage(handler);
          resolve(msg as never);
        }
      };

      this.onMessage(handler);
      this.sendFn(message);

      // Timeout after 10 seconds
      setTimeout(() => {
        this.offMessage(handler);
        reject(new Error('Produce timeout'));
      }, 10000);
    });
  }

  /**
   * Get all producers
   */
  getProducers(): types.Producer[] {
    return Array.from(this.producers.values());
  }

  /**
   * Get a producer by ID
   */
  getProducer(id: string): types.Producer | undefined {
    return this.producers.get(id);
  }

  /**
   * Close all producers
   */
  close(): void {
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();
    logger.info('Producer manager closed');
  }
}
