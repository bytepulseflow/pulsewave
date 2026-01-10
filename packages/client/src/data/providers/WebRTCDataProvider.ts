/**
 * WebRTCDataProvider - Data transmission via WebRTC data channels
 *
 * This provider uses mediasoup's DataProducer and DataConsumer for peer-to-peer
 * data transmission through the SFU (Selective Forwarding Unit).
 */

import type {
  DataProvider,
  DataProviderConfig,
  DataProviderEvents,
  DataPacket,
} from '@bytepulse/pulsewave-shared';
import { DataProviderType, DataPacketKind, DataChannelKind } from '@bytepulse/pulsewave-shared';
import type { types } from 'mediasoup-client';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('data-provider:webrtc');

/**
 * WebRTC data channel configuration
 */
interface WebRTCDataChannelConfig {
  label: string;
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
}

/**
 * Data producer info
 */
interface DataProducerInfo {
  id: string;
  kind: DataChannelKind;
  dataProducer: types.DataProducer;
}

/**
 * Data consumer info
 */
interface DataConsumerInfo {
  id: string;
  participantSid: string;
  kind: DataChannelKind;
  dataConsumer: types.DataConsumer;
}

/**
 * WebRTC data channel options
 */
export interface WebRTCDataProviderOptions {
  /** Function to create a data producer */
  createDataProducer: (
    options: WebRTCDataChannelConfig
  ) => Promise<{ id: string; dataProducer: types.DataProducer }>;
  /** Function to close a data producer */
  closeDataProducer: (producerId: string) => Promise<void>;
  /** Function to handle incoming data consumer */
  onDataConsumer?: (consumer: DataConsumerInfo) => void;
  /** Function to handle data consumer closed */
  onDataConsumerClosed?: (consumerId: string) => void;
}

/**
 * WebRTCDataProvider - sends data via WebRTC data channels
 */
export class WebRTCDataProvider implements DataProvider {
  public readonly type = DataProviderType.WebRTC;
  public readonly config: DataProviderConfig;

  private listeners: Map<keyof DataProviderEvents, Set<(...args: unknown[]) => void>> = new Map();
  private options: WebRTCDataProviderOptions;
  private _isReady = false;

  // Data producers (outgoing data)
  private reliableProducer: DataProducerInfo | null = null;
  private lossyProducer: DataProducerInfo | null = null;

  // Data consumers (incoming data)
  private consumers: Map<string, DataConsumerInfo> = new Map();

  constructor(options: WebRTCDataProviderOptions, config?: Partial<DataProviderConfig>) {
    this.config = {
      type: DataProviderType.WebRTC,
      maxMessageSize: config?.maxMessageSize || 262144, // 256KB default for WebRTC
      ordered: config?.ordered !== false,
      maxPacketLifeTime: config?.maxPacketLifeTime,
      maxRetransmits: config?.maxRetransmits,
      ...config,
    };
    this.options = options;
  }

  /**
   * Initialize the WebRTC data provider
   */
  async initialize(): Promise<void> {
    try {
      // Create reliable data producer
      this.reliableProducer = await this.createProducer(DataChannelKind.Reliable);
      logger.info('Reliable data producer created', { id: this.reliableProducer.id });

      // Create lossy data producer
      this.lossyProducer = await this.createProducer(DataChannelKind.Lossy);
      logger.info('Lossy data producer created', { id: this.lossyProducer.id });

      // Wait for both data channels to be open
      await this.waitForChannelsToOpen();

      this._isReady = true;
      this.emit('connected');
      logger.info('WebRTC data provider initialized and ready');
    } catch (error) {
      logger.error('Failed to initialize WebRTC data provider', { error });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Wait for both data channels to be open
   */
  private async waitForChannelsToOpen(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.reliableProducer) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          const reliableProducer = this.reliableProducer;
          if (!reliableProducer) {
            reject(new Error('Reliable producer not available'));
            return;
          }

          // Listen for the 'open' event from the DataProducer
          reliableProducer.dataProducer.on('open', () => {
            logger.debug('Reliable data channel opened');
            resolve();
          });

          // Listen for errors
          reliableProducer.dataProducer.on('error', (error: Error) => {
            reject(new Error(`Reliable data channel error: ${error.message}`));
          });

          // Listen for close
          reliableProducer.dataProducer.on('close', () => {
            reject(new Error('Reliable data channel closed before opening'));
          });
        })
      );
    }

    if (this.lossyProducer) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          const lossyProducer = this.lossyProducer;
          if (!lossyProducer) {
            reject(new Error('Lossy producer not available'));
            return;
          }

          // Listen for the 'open' event from the DataProducer
          lossyProducer.dataProducer.on('open', () => {
            logger.debug('Lossy data channel opened');
            resolve();
          });

          // Listen for errors
          lossyProducer.dataProducer.on('error', (error: Error) => {
            reject(new Error(`Lossy data channel error: ${error.message}`));
          });

          // Listen for close
          lossyProducer.dataProducer.on('close', () => {
            reject(new Error('Lossy data channel closed before opening'));
          });
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Send data via WebRTC data channel
   */
  async send(data: unknown, kind: DataChannelKind): Promise<void> {
    if (!this._isReady) {
      throw new Error('WebRTC data provider not ready');
    }

    const producer = kind === DataChannelKind.Reliable ? this.reliableProducer : this.lossyProducer;
    if (!producer) {
      throw new Error(`${kind} data producer not found`);
    }

    // Check message size
    const dataSize = this.getDataSize(data);
    if (this.config.maxMessageSize && dataSize > this.config.maxMessageSize) {
      throw new Error(`Message size ${dataSize} exceeds maximum ${this.config.maxMessageSize}`);
    }

    try {
      const payload = this.serializeData(data);
      producer.dataProducer.send(payload);
      logger.debug(`Sent data via WebRTC: ${kind}, size: ${dataSize}`);
    } catch (error) {
      logger.error('Failed to send data via WebRTC', { error });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Close the WebRTC data provider
   */
  async close(): Promise<void> {
    this._isReady = false;

    // Close all producers
    if (this.reliableProducer) {
      await this.closeProducer(this.reliableProducer);
      this.reliableProducer = null;
    }
    if (this.lossyProducer) {
      await this.closeProducer(this.lossyProducer);
      this.lossyProducer = null;
    }

    // Close all consumers
    this.consumers.forEach((consumer) => {
      consumer.dataConsumer.close();
    });
    this.consumers.clear();

    this.removeAllListeners();
    this.emit('disconnected');
    logger.info('WebRTC data provider closed');
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
   * Add a data consumer (incoming data from another participant)
   */
  addDataConsumer(consumer: DataConsumerInfo): void {
    this.consumers.set(consumer.id, consumer);

    // Set up message handler
    consumer.dataConsumer.on('message', (data: string | Blob | ArrayBuffer) => {
      try {
        const deserializedData = this.deserializeData(data);
        const packet: DataPacket = {
          kind:
            consumer.kind === DataChannelKind.Reliable
              ? DataPacketKind.Reliable
              : DataPacketKind.Lossy,
          value: deserializedData,
          participantSid: consumer.participantSid,
          timestamp: Date.now(),
        };
        this.emit('data-received', packet, consumer.participantSid);
      } catch (error) {
        logger.error('Failed to handle data consumer message', { error });
      }
    });

    // Set up close handler
    consumer.dataConsumer.on('close', () => {
      this.consumers.delete(consumer.id);
      this.options.onDataConsumerClosed?.(consumer.id);
      logger.debug('Data consumer closed', { id: consumer.id });
    });

    // Notify callback
    this.options.onDataConsumer?.(consumer);
    logger.info('Data consumer added', { id: consumer.id, kind: consumer.kind });
  }

  /**
   * Remove a data consumer
   */
  removeDataConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.dataConsumer.close();
      this.consumers.delete(consumerId);
      logger.info('Data consumer removed', { id: consumerId });
    }
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
   * Create a data producer
   */
  private async createProducer(kind: DataChannelKind): Promise<DataProducerInfo> {
    const config: WebRTCDataChannelConfig = {
      label: `data-${kind}`,
      ordered: this.config.ordered,
    };

    if (kind === DataChannelKind.Lossy) {
      config.maxPacketLifeTime = this.config.maxPacketLifeTime;
      config.maxRetransmits = this.config.maxRetransmits;
    }

    const { id, dataProducer } = await this.options.createDataProducer(config);

    // Set up close handler
    dataProducer.on('close', () => {
      logger.debug('Data producer channel closed', { id, kind });
    });

    // Set up error handler
    dataProducer.on('error', (error: Error) => {
      logger.error('Data producer channel error', { id, kind, error });
      this.emit('error', new Error(`Data producer error: ${error.message}`));
    });

    return { id, kind, dataProducer };
  }

  /**
   * Close a data producer
   */
  private async closeProducer(producer: DataProducerInfo): Promise<void> {
    try {
      producer.dataProducer.close();
      await this.options.closeDataProducer(producer.id);
      logger.info('Data producer closed', { id: producer.id, kind: producer.kind });
    } catch (error) {
      logger.error('Failed to close data producer', { error });
    }
  }

  /**
   * Serialize data for transmission
   */
  private serializeData(data: unknown): string | Blob | ArrayBuffer {
    if (typeof data === 'string') {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return data;
    }
    if (ArrayBuffer.isView(data)) {
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return buffer as ArrayBuffer;
    }
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data);
    }
    return String(data);
  }

  /**
   * Deserialize data from transmission
   */
  private deserializeData(data: string | Blob | ArrayBuffer): unknown {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    if (data instanceof Blob) {
      // Convert Blob to ArrayBuffer for consistency
      return data.arrayBuffer();
    }
    return data;
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
