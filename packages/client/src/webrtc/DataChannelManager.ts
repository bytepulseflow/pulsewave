/**
 * DataChannelManager - Manages data channels (producers and consumers)
 */

import { types } from 'mediasoup-client';
import type { DataChannelKind } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('data-channel-manager');

/**
 * DataChannelManager options
 */
export interface DataChannelManagerOptions {
  sendFn: (message: Record<string, unknown>) => void;
  onMessage: (handler: (data: unknown) => void) => void;
  offMessage: (handler: (data: unknown) => void) => void;
  getSendTransport: () => types.Transport | null;
  getRecvTransport: () => types.Transport | null;
}

/**
 * DataChannelManager - Manages data channels
 */
export class DataChannelManager {
  private dataProducers: Map<string, types.DataProducer> = new Map();
  private dataConsumers: Map<string, types.DataConsumer> = new Map();
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;
  private getSendTransport: () => types.Transport | null;
  private getRecvTransport: () => types.Transport | null;

  constructor(options: DataChannelManagerOptions) {
    this.sendFn = options.sendFn;
    this.onMessage = options.onMessage;
    this.offMessage = options.offMessage;
    this.getSendTransport = options.getSendTransport;
    this.getRecvTransport = options.getRecvTransport;
  }

  /**
   * Create a data producer
   */
  async createDataProducer(
    kind: DataChannelKind,
    options: {
      label: string;
      ordered?: boolean;
      maxPacketLifeTime?: number;
      maxRetransmits?: number;
    }
  ): Promise<{ id: string; dataProducer: types.DataProducer }> {
    const transport = this.getSendTransport();
    if (!transport) {
      throw new Error('Send transport not created');
    }

    const dataProducer = await transport.produceData({
      label: options.label,
      ordered: options.ordered !== false,
      maxPacketLifeTime: options.maxPacketLifeTime,
      maxRetransmits: options.maxRetransmits,
    });

    this.dataProducers.set(dataProducer.id, dataProducer);

    logger.info(`Data producer created: ${dataProducer.id}, kind: ${kind}`);

    return {
      id: dataProducer.id,
      dataProducer,
    };
  }

  /**
   * Request to produce a data channel
   */
  async requestProduceData(
    transportId: string,
    sctpStreamParameters: types.SctpStreamParameters,
    label?: string,
    protocol?: string,
    appData?: Record<string, unknown>
  ): Promise<{ id: string }> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'create_data_producer',
        transportId,
        sctpStreamParameters,
        label,
        protocol,
        appData,
      };

      const handler = (data: unknown) => {
        const msg = data as Record<string, unknown>;
        if (msg.type === 'data_producer_created' && msg.id) {
          this.offMessage(handler);
          resolve(msg as never);
        }
      };

      this.onMessage(handler);
      this.sendFn(message);

      // Timeout after 10 seconds
      setTimeout(() => {
        this.offMessage(handler);
        reject(new Error('ProduceData timeout'));
      }, 10000);
    });
  }

  /**
   * Close a data producer
   */
  async closeDataProducer(producerId: string): Promise<void> {
    const dataProducer = this.dataProducers.get(producerId);
    if (dataProducer) {
      dataProducer.close();
      this.dataProducers.delete(producerId);

      this.sendFn({
        type: 'close_data_producer',
        dataProducerId: producerId,
      });

      logger.info(`Data producer closed: ${producerId}`);
    }
  }

  /**
   * Add a data consumer (called when server notifies of new data consumer)
   */
  async addDataConsumer(
    dataProducerId: string,
    options: {
      id: string;
      sctpStreamParameters: types.SctpStreamParameters;
      participantSid: string;
      label: string;
      ordered?: boolean;
    }
  ): Promise<{ id: string; dataConsumer: types.DataConsumer }> {
    const transport = this.getRecvTransport();
    if (!transport) {
      throw new Error('Receive transport not created');
    }

    const dataConsumer = await transport.consumeData({
      id: options.id,
      dataProducerId,
      sctpStreamParameters: options.sctpStreamParameters,
    });

    this.dataConsumers.set(dataConsumer.id, dataConsumer);

    logger.info(
      `Data consumer added: ${dataConsumer.id}, producer: ${dataProducerId}, participant: ${options.participantSid}`
    );

    return {
      id: dataConsumer.id,
      dataConsumer,
    };
  }

  /**
   * Close a data consumer
   */
  async closeDataConsumer(consumerId: string): Promise<void> {
    const dataConsumer = this.dataConsumers.get(consumerId);
    if (dataConsumer) {
      dataConsumer.close();
      this.dataConsumers.delete(consumerId);

      logger.info(`Data consumer closed: ${consumerId}`);
    }
  }

  /**
   * Get all data producers
   */
  getDataProducers(): types.DataProducer[] {
    return Array.from(this.dataProducers.values());
  }

  /**
   * Get all data consumers
   */
  getDataConsumers(): types.DataConsumer[] {
    return Array.from(this.dataConsumers.values());
  }

  /**
   * Get a data producer by ID
   */
  getDataProducer(id: string): types.DataProducer | undefined {
    return this.dataProducers.get(id);
  }

  /**
   * Get a data consumer by ID
   */
  getDataConsumer(id: string): types.DataConsumer | undefined {
    return this.dataConsumers.get(id);
  }

  /**
   * Close all data channels
   */
  close(): void {
    for (const dataProducer of this.dataProducers.values()) {
      dataProducer.close();
    }
    this.dataProducers.clear();

    for (const dataConsumer of this.dataConsumers.values()) {
      dataConsumer.close();
    }
    this.dataConsumers.clear();

    logger.info('Data channel manager closed');
  }
}
