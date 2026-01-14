/**
 * MediasoupAdapter - Adapter layer for mediasoup operations
 *
 * This is the ONLY place that touches mediasoup APIs.
 * It translates high-level application intents to low-level mediasoup operations.
 */

import type {
  Router,
  Transport,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
  DtlsParameters as MediasoupDtlsParameters,
  RtpCapabilities as MediasoupRtpCapabilities,
  RtpParameters as MediasoupRtpParameters,
  SctpStreamParameters as MediasoupSctpStreamParameters,
} from 'mediasoup/types';
import type {
  TrackKind,
  IceParameters,
  IceCandidate,
  DtlsParameters,
  SctpParameters,
  RtpCapabilities,
  RtpParameters,
  ProducerStat,
  ConsumerStat,
} from '@bytepulse/pulsewave-shared';
import type {
  MediaAdapter,
  MediasoupAdapterOptions,
  TransportOptions,
  ProducerOptions,
  ConsumerOptions,
  DataProducerOptions,
  DataConsumerOptions,
  TransportInfo,
  ProducerInfo,
  ConsumerInfo,
  DataProducerInfo,
  DataConsumerInfo,
} from './types';
import { createModuleLogger } from '../utils/logger';
import { withTimeout, DEFAULT_TIMEOUTS, getTimeout } from '../utils/timeout';
import { ResourceNotFoundError, MediaError } from '../domain';

const logger = createModuleLogger('adapter:mediasoup');

/**
 * Type assertion helper for mediasoup event listeners
 * Mediasoup event types are not properly typed, so we use this helper
 */
type MediasoupEventListener = (...args: unknown[]) => void;

/**
 * Mediasoup Adapter
 *
 * This class provides a high-level interface for mediasoup operations.
 * It is stateful and imperative, not React-aware.
 */
export class MediasoupAdapter implements MediaAdapter {
  private router: Router;
  private options: MediasoupAdapterOptions;
  private transports: Map<string, Transport>;
  private producers: Map<string, Producer>;
  private consumers: Map<string, Consumer>;
  private dataProducers: Map<string, DataProducer>;
  private dataConsumers: Map<string, DataConsumer>;

  // Track ownership of resources by transport
  private transportProducers: Map<string, Set<string>>;
  private transportConsumers: Map<string, Set<string>>;
  private transportDataProducers: Map<string, Set<string>>;
  private transportDataConsumers: Map<string, Set<string>>;

  // Track creation time for cleanup
  private transportCreationTimes: Map<string, number>;
  private producerCreationTimes: Map<string, number>;
  private consumerCreationTimes: Map<string, number>;
  private dataProducerCreationTimes: Map<string, number>;
  private dataConsumerCreationTimes: Map<string, number>;

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(options: MediasoupAdapterOptions) {
    this.router = options.router;
    this.options = options;
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.dataProducers = new Map();
    this.dataConsumers = new Map();

    // Initialize ownership tracking maps
    this.transportProducers = new Map();
    this.transportConsumers = new Map();
    this.transportDataProducers = new Map();
    this.transportDataConsumers = new Map();

    // Initialize creation time tracking
    this.transportCreationTimes = new Map();
    this.producerCreationTimes = new Map();
    this.consumerCreationTimes = new Map();
    this.dataProducerCreationTimes = new Map();
    this.dataConsumerCreationTimes = new Map();

    // Initialize cleanup interval
    this.cleanupInterval = null;

    // Start automatic cleanup if enabled
    if (options.enableAutoCleanup !== false) {
      this.startAutoCleanup();
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    const cleanupIntervalMs = this.options.cleanupIntervalMs || 5 * 60 * 1000; // Default: 5 minutes
    const resourceMaxAge = this.options.resourceMaxAge || 60 * 60 * 1000; // Default: 1 hour

    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanedResources(resourceMaxAge);
    }, cleanupIntervalMs);

    logger.info(
      `Auto-cleanup started (interval: ${cleanupIntervalMs}ms, max age: ${resourceMaxAge}ms)`
    );
  }

  /**
   * Stop automatic cleanup interval
   */
  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Auto-cleanup stopped');
    }
  }

  /**
   * Cleanup orphaned resources older than maxAge
   */
  private cleanupOrphanedResources(maxAge: number): void {
    const now = Date.now();
    let cleaned = 0;

    // Cleanup orphaned transports (no associated producers/consumers)
    for (const [transportId, transport] of this.transports.entries()) {
      const creationTime = this.transportCreationTimes.get(transportId) || 0;
      const age = now - creationTime;

      // Check if transport is orphaned (no child resources) and old enough
      const hasChildren =
        (this.transportProducers.get(transportId)?.size || 0) > 0 ||
        (this.transportConsumers.get(transportId)?.size || 0) > 0 ||
        (this.transportDataProducers.get(transportId)?.size || 0) > 0 ||
        (this.transportDataConsumers.get(transportId)?.size || 0) > 0;

      if (!hasChildren && age > maxAge) {
        logger.warn(`Cleaning up orphaned transport: ${transportId} (age: ${age}ms)`);
        transport.close();
        this.transports.delete(transportId);
        this.transportCreationTimes.delete(transportId);
        this.transportProducers.delete(transportId);
        this.transportConsumers.delete(transportId);
        this.transportDataProducers.delete(transportId);
        this.transportDataConsumers.delete(transportId);
        cleaned++;
      }
    }

    // Cleanup orphaned producers (no associated transport)
    for (const [producerId, producer] of this.producers.entries()) {
      const creationTime = this.producerCreationTimes.get(producerId) || 0;
      const age = now - creationTime;

      // Check if producer is orphaned (not in any transport's producer list)
      let isOrphaned = true;
      for (const producerIds of this.transportProducers.values()) {
        if (producerIds.has(producerId)) {
          isOrphaned = false;
          break;
        }
      }

      if (isOrphaned && age > maxAge) {
        logger.warn(`Cleaning up orphaned producer: ${producerId} (age: ${age}ms)`);
        producer.close();
        this.producers.delete(producerId);
        this.producerCreationTimes.delete(producerId);
        cleaned++;
      }
    }

    // Cleanup orphaned consumers
    for (const [consumerId, consumer] of this.consumers.entries()) {
      const creationTime = this.consumerCreationTimes.get(consumerId) || 0;
      const age = now - creationTime;

      let isOrphaned = true;
      for (const consumerIds of this.transportConsumers.values()) {
        if (consumerIds.has(consumerId)) {
          isOrphaned = false;
          break;
        }
      }

      if (isOrphaned && age > maxAge) {
        logger.warn(`Cleaning up orphaned consumer: ${consumerId} (age: ${age}ms)`);
        consumer.close();
        this.consumers.delete(consumerId);
        this.consumerCreationTimes.delete(consumerId);
        cleaned++;
      }
    }

    // Cleanup orphaned data producers
    for (const [dataProducerId, dataProducer] of this.dataProducers.entries()) {
      const creationTime = this.dataProducerCreationTimes.get(dataProducerId) || 0;
      const age = now - creationTime;

      let isOrphaned = true;
      for (const dataProducerIds of this.transportDataProducers.values()) {
        if (dataProducerIds.has(dataProducerId)) {
          isOrphaned = false;
          break;
        }
      }

      if (isOrphaned && age > maxAge) {
        logger.warn(`Cleaning up orphaned data producer: ${dataProducerId} (age: ${age}ms)`);
        dataProducer.close();
        this.dataProducers.delete(dataProducerId);
        this.dataProducerCreationTimes.delete(dataProducerId);
        cleaned++;
      }
    }

    // Cleanup orphaned data consumers
    for (const [dataConsumerId, dataConsumer] of this.dataConsumers.entries()) {
      const creationTime = this.dataConsumerCreationTimes.get(dataConsumerId) || 0;
      const age = now - creationTime;

      let isOrphaned = true;
      for (const dataConsumerIds of this.transportDataConsumers.values()) {
        if (dataConsumerIds.has(dataConsumerId)) {
          isOrphaned = false;
          break;
        }
      }

      if (isOrphaned && age > maxAge) {
        logger.warn(`Cleaning up orphaned data consumer: ${dataConsumerId} (age: ${age}ms)`);
        dataConsumer.close();
        this.dataConsumers.delete(dataConsumerId);
        this.dataConsumerCreationTimes.delete(dataConsumerId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Auto-cleanup removed ${cleaned} orphaned resources`);
    }
  }

  /**
   * Get resource statistics
   */
  public getResourceStats(): {
    transports: number;
    producers: number;
    consumers: number;
    dataProducers: number;
    dataConsumers: number;
    total: number;
  } {
    return {
      transports: this.transports.size,
      producers: this.producers.size,
      consumers: this.consumers.size,
      dataProducers: this.dataProducers.size,
      dataConsumers: this.dataConsumers.size,
      total:
        this.transports.size +
        this.producers.size +
        this.consumers.size +
        this.dataProducers.size +
        this.dataConsumers.size,
    };
  }

  /**
   * Shutdown the adapter and cleanup all resources
   */
  public async shutdown(): Promise<void> {
    this.stopAutoCleanup();
    await this.close();
    logger.info('MediasoupAdapter shutdown complete');
  }

  /**
   * Get timeout value for an operation
   */
  private getTimeout(operation: keyof typeof DEFAULT_TIMEOUTS): number {
    const envVar = process.env[`TIMEOUT_${operation.toUpperCase()}`];
    return getTimeout(envVar, DEFAULT_TIMEOUTS[operation]);
  }

  /**
   * Create a WebRTC transport
   */
  public async createTransport(options: TransportOptions): Promise<TransportInfo> {
    const transport = await withTimeout(
      this.router.createWebRtcTransport({
        enableUdp: options.enableUdp ?? this.options.enableUdp ?? true,
        enableTcp: options.enableTcp ?? this.options.enableTcp ?? true,
        preferUdp: options.preferUdp ?? this.options.preferUdp ?? true,
        enableSctp: options.enableSctp ?? this.options.enableSctp ?? false,
        listenIps: this.options.listenIps,
        initialAvailableOutgoingBitrate: this.options.initialAvailableOutgoingBitrate,
      }),
      this.getTimeout('TRANSPORT_CREATE'),
      'createTransport'
    );

    this.transports.set(transport.id, transport);
    this.transportCreationTimes.set(transport.id, Date.now());

    // Initialize ownership tracking for this transport
    this.transportProducers.set(transport.id, new Set());
    this.transportConsumers.set(transport.id, new Set());
    this.transportDataProducers.set(transport.id, new Set());
    this.transportDataConsumers.set(transport.id, new Set());

    // Listen for transport close events
    transport.on('@close', () => {
      logger.warn(`Transport ${transport.id} closed by mediasoup`);
      this.handleTransportClose(transport.id);
    });

    logger.debug(`Created transport: ${transport.id} (${options.direction})`);

    return {
      id: transport.id,
      direction: options.direction,
      iceParameters: transport.iceParameters as IceParameters,
      iceCandidates: transport.iceCandidates as IceCandidate[],
      dtlsParameters: transport.dtlsParameters as DtlsParameters,
      sctpParameters: transport.sctpParameters as SctpParameters | undefined,
    };
  }

  /**
   * Connect a transport
   */
  public async connectTransport(
    transportId: string,
    dtlsParameters: DtlsParameters
  ): Promise<void> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new ResourceNotFoundError('Transport', transportId);
    }

    await withTimeout(
      transport.connect({ dtlsParameters: dtlsParameters as MediasoupDtlsParameters }),
      this.getTimeout('TRANSPORT_CONNECT'),
      'connectTransport'
    );
    logger.debug(`Connected transport: ${transportId}`);
  }

  /**
   * Create a producer (publish a track)
   */
  public async createProducer(
    transportId: string,
    options: ProducerOptions
  ): Promise<ProducerInfo> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new ResourceNotFoundError('Transport', transportId);
    }

    const producer = await withTimeout(
      transport.produce({
        kind: options.kind as 'audio' | 'video',
        rtpParameters: options.rtpParameters as MediasoupRtpParameters,
        paused: options.paused ?? false,
        appData: options.appData, // Forward appData without orchestration
      }),
      this.getTimeout('PRODUCER_CREATE'),
      'createProducer'
    );

    this.producers.set(producer.id, producer);
    this.producerCreationTimes.set(producer.id, Date.now());

    // Track ownership
    const producerIds = this.transportProducers.get(transportId);
    if (producerIds) {
      producerIds.add(producer.id);
    }

    // Listen for producer close events
    producer.on('@close', (() => {
      logger.warn(`Producer ${producer.id} closed`);
      this.producers.delete(producer.id);
      const ids = this.transportProducers.get(transportId);
      if (ids) {
        ids.delete(producer.id);
      }
    }) as MediasoupEventListener);

    logger.debug(`Created producer: ${producer.id} (${options.kind} from ${options.source})`);

    return {
      id: producer.id,
      kind: producer.kind as TrackKind,
      source: options.source,
      paused: producer.paused,
    };
  }

  /**
   * Create a consumer (subscribe to a track)
   */
  public async createConsumer(
    transportId: string,
    options: ConsumerOptions
  ): Promise<ConsumerInfo> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new ResourceNotFoundError('Transport', transportId);
    }

    const producer = this.producers.get(options.producerId);
    if (!producer) {
      throw new ResourceNotFoundError('Producer', options.producerId);
    }

    // Check if we can consume this producer
    const rtpCapabilities =
      options.rtpCapabilities ?? (this.router.rtpCapabilities as RtpCapabilities);
    if (
      !this.router.canConsume({
        producerId: options.producerId,
        rtpCapabilities: rtpCapabilities as MediasoupRtpCapabilities,
      })
    ) {
      throw new MediaError('consume', 'Codec mismatch or unsupported', {
        producerId: options.producerId,
      });
    }

    const consumer = await withTimeout(
      transport.consume({
        producerId: options.producerId,
        rtpCapabilities: rtpCapabilities as MediasoupRtpCapabilities,
        paused: options.paused ?? false,
        appData: options.appData,
      }),
      this.getTimeout('CONSUMER_CREATE'),
      'createConsumer'
    );

    this.consumers.set(consumer.id, consumer);
    this.consumerCreationTimes.set(consumer.id, Date.now());

    // Track ownership
    const consumerIds = this.transportConsumers.get(transportId);
    if (consumerIds) {
      consumerIds.add(consumer.id);
    }

    // Listen for consumer close events
    consumer.on('@close', (() => {
      logger.warn(`Consumer ${consumer.id} closed`);
      this.consumers.delete(consumer.id);
      const ids = this.transportConsumers.get(transportId);
      if (ids) {
        ids.delete(consumer.id);
      }
    }) as MediasoupEventListener);

    consumer.on('@producerclose', (() => {
      logger.warn(`Consumer ${consumer.id} closed due to producer close`);
      this.consumers.delete(consumer.id);
      const ids = this.transportConsumers.get(transportId);
      if (ids) {
        ids.delete(consumer.id);
      }
    }) as MediasoupEventListener);

    logger.debug(`Created consumer: ${consumer.id} for producer ${options.producerId}`);

    return {
      id: consumer.id,
      producerId: options.producerId,
      kind: consumer.kind as TrackKind,
      paused: consumer.paused,
      rtpParameters: consumer.rtpParameters as RtpParameters,
    };
  }

  /**
   * Pause a producer
   */
  public async pauseProducer(producerId: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new ResourceNotFoundError('Producer', producerId);
    }

    await withTimeout(producer.pause(), this.getTimeout('PRODUCER_PAUSE'), 'pauseProducer');
    logger.debug(`Paused producer: ${producerId}`);
  }

  /**
   * Resume a producer
   */
  public async resumeProducer(producerId: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new ResourceNotFoundError('Producer', producerId);
    }

    await withTimeout(producer.resume(), this.getTimeout('PRODUCER_RESUME'), 'resumeProducer');
    logger.debug(`Resumed producer: ${producerId}`);
  }

  /**
   * Close a producer
   */
  public async closeProducer(producerId: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new ResourceNotFoundError('Producer', producerId);
    }

    await withTimeout(
      Promise.resolve(producer.close()),
      this.getTimeout('PRODUCER_CLOSE'),
      'closeProducer'
    );
    this.producers.delete(producerId);
    logger.debug(`Closed producer: ${producerId}`);
  }

  /**
   * Pause a consumer
   */
  public async pauseConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new ResourceNotFoundError('Consumer', consumerId);
    }

    await withTimeout(consumer.pause(), this.getTimeout('CONSUMER_PAUSE'), 'pauseConsumer');
    logger.debug(`Paused consumer: ${consumerId}`);
  }

  /**
   * Resume a consumer
   */
  public async resumeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new ResourceNotFoundError('Consumer', consumerId);
    }

    await withTimeout(consumer.resume(), this.getTimeout('CONSUMER_RESUME'), 'resumeConsumer');
    logger.debug(`Resumed consumer: ${consumerId}`);
  }

  /**
   * Close a consumer
   */
  public async closeConsumer(consumerId: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new ResourceNotFoundError('Consumer', consumerId);
    }

    await withTimeout(
      Promise.resolve(consumer.close()),
      this.getTimeout('CONSUMER_CLOSE'),
      'closeConsumer'
    );
    this.consumers.delete(consumerId);
    logger.debug(`Closed consumer: ${consumerId}`);
  }

  /**
   * Create a data producer
   */
  public async createDataProducer(
    transportId: string,
    options: DataProducerOptions
  ): Promise<DataProducerInfo> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new ResourceNotFoundError('Transport', transportId);
    }

    const dataProducer = await withTimeout(
      transport.produceData({
        sctpStreamParameters: options.sctpStreamParameters as MediasoupSctpStreamParameters,
        label: options.label,
        protocol: options.protocol,
        appData: options.appData,
      }),
      this.getTimeout('DATA_PRODUCER_CREATE'),
      'createDataProducer'
    );

    this.dataProducers.set(dataProducer.id, dataProducer);
    this.dataProducerCreationTimes.set(dataProducer.id, Date.now());

    // Track ownership
    const dataProducerIds = this.transportDataProducers.get(transportId);
    if (dataProducerIds) {
      dataProducerIds.add(dataProducer.id);
    }

    // Listen for data producer close events
    dataProducer.on('@close', (() => {
      logger.warn(`Data producer ${dataProducer.id} closed`);
      this.dataProducers.delete(dataProducer.id);
      const ids = this.transportDataProducers.get(transportId);
      if (ids) {
        ids.delete(dataProducer.id);
      }
    }) as MediasoupEventListener);

    logger.debug(`Created data producer: ${dataProducer.id}`);

    return {
      id: dataProducer.id,
      label: options.label,
      protocol: options.protocol,
    };
  }

  /**
   * Create a data consumer
   */
  public async createDataConsumer(
    transportId: string,
    options: DataConsumerOptions
  ): Promise<DataConsumerInfo> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new ResourceNotFoundError('Transport', transportId);
    }

    const dataProducer = this.dataProducers.get(options.dataProducerId);
    if (!dataProducer) {
      throw new ResourceNotFoundError('DataProducer', options.dataProducerId);
    }

    const dataConsumer = await withTimeout(
      transport.consumeData({
        dataProducerId: options.dataProducerId,
        appData: options.appData,
      }),
      this.getTimeout('DATA_CONSUMER_CREATE'),
      'createDataConsumer'
    );

    this.dataConsumers.set(dataConsumer.id, dataConsumer);
    this.dataConsumerCreationTimes.set(dataConsumer.id, Date.now());

    // Track ownership
    const dataConsumerIds = this.transportDataConsumers.get(transportId);
    if (dataConsumerIds) {
      dataConsumerIds.add(dataConsumer.id);
    }

    // Listen for data consumer close events
    dataConsumer.on('@close', (() => {
      logger.warn(`Data consumer ${dataConsumer.id} closed`);
      this.dataConsumers.delete(dataConsumer.id);
      const ids = this.transportDataConsumers.get(transportId);
      if (ids) {
        ids.delete(dataConsumer.id);
      }
    }) as MediasoupEventListener);

    dataConsumer.on('@dataproducerclose', (() => {
      logger.warn(`Data consumer ${dataConsumer.id} closed due to data producer close`);
      this.dataConsumers.delete(dataConsumer.id);
      const ids = this.transportDataConsumers.get(transportId);
      if (ids) {
        ids.delete(dataConsumer.id);
      }
    }) as MediasoupEventListener);

    logger.debug(`Created data consumer: ${dataConsumer.id}`);

    return {
      id: dataConsumer.id,
      dataProducerId: options.dataProducerId,
    };
  }

  /**
   * Close a data producer
   */
  public async closeDataProducer(dataProducerId: string): Promise<void> {
    const dataProducer = this.dataProducers.get(dataProducerId);
    if (!dataProducer) {
      throw new ResourceNotFoundError('DataProducer', dataProducerId);
    }

    await withTimeout(
      Promise.resolve(dataProducer.close()),
      this.getTimeout('DATA_PRODUCER_CLOSE'),
      'closeDataProducer'
    );
    this.dataProducers.delete(dataProducerId);
    logger.debug(`Closed data producer: ${dataProducerId}`);
  }

  /**
   * Close a data consumer
   */
  public async closeDataConsumer(dataConsumerId: string): Promise<void> {
    const dataConsumer = this.dataConsumers.get(dataConsumerId);
    if (!dataConsumer) {
      throw new ResourceNotFoundError('DataConsumer', dataConsumerId);
    }

    await withTimeout(
      Promise.resolve(dataConsumer.close()),
      this.getTimeout('DATA_CONSUMER_CLOSE'),
      'closeDataConsumer'
    );
    this.dataConsumers.delete(dataConsumerId);
    logger.debug(`Closed data consumer: ${dataConsumerId}`);
  }

  /**
   * Handle transport close event
   */
  private handleTransportClose(transportId: string): void {
    // Clean up ownership tracking
    this.transportProducers.delete(transportId);
    this.transportConsumers.delete(transportId);
    this.transportDataProducers.delete(transportId);
    this.transportDataConsumers.delete(transportId);
    this.transportCreationTimes.delete(transportId);
  }

  /**
   * Close a transport
   */
  public async closeTransport(transportId: string): Promise<void> {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new ResourceNotFoundError('Transport', transportId);
    }

    // Close only producers belonging to this transport
    const producerIds = this.transportProducers.get(transportId) ?? [];
    for (const id of producerIds) {
      await this.closeProducer(id);
    }
    this.transportProducers.delete(transportId);

    // Close only consumers belonging to this transport
    const consumerIds = this.transportConsumers.get(transportId) ?? [];
    for (const id of consumerIds) {
      await this.closeConsumer(id);
    }
    this.transportConsumers.delete(transportId);

    // Close only data producers belonging to this transport
    const dataProducerIds = this.transportDataProducers.get(transportId) ?? [];
    for (const id of dataProducerIds) {
      await this.closeDataProducer(id);
    }
    this.transportDataProducers.delete(transportId);

    // Close only data consumers belonging to this transport
    const dataConsumerIds = this.transportDataConsumers.get(transportId) ?? [];
    for (const id of dataConsumerIds) {
      await this.closeDataConsumer(id);
    }
    this.transportDataConsumers.delete(transportId);

    await transport.close();
    this.transports.delete(transportId);
    logger.debug(`Closed transport: ${transportId}`);
  }

  /**
   * Close all resources
   */
  public async close(): Promise<void> {
    // Close all transports (this will cascade to close all owned resources)
    for (const transport of this.transports.values()) {
      await transport.close();
    }
    this.transports.clear();

    // Clear ownership tracking maps
    this.transportProducers.clear();
    this.transportConsumers.clear();
    this.transportDataProducers.clear();
    this.transportDataConsumers.clear();

    // Clear creation time tracking
    this.transportCreationTimes.clear();
    this.producerCreationTimes.clear();
    this.consumerCreationTimes.clear();
    this.dataProducerCreationTimes.clear();
    this.dataConsumerCreationTimes.clear();

    // Clear remaining resources (should be empty if transports closed properly)
    this.producers.clear();
    this.consumers.clear();
    this.dataProducers.clear();
    this.dataConsumers.clear();

    logger.debug('Closed all mediasoup resources');
  }

  /**
   * Get router RTP capabilities
   */
  public getRtpCapabilities(): RtpCapabilities {
    return this.router.rtpCapabilities as RtpCapabilities;
  }

  /**
   * Get producer stats
   */
  public async getProducerStats(producerId: string): Promise<ProducerStat[]> {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new ResourceNotFoundError('Producer', producerId);
    }

    const stats = await withTimeout(
      producer.getStats(),
      this.getTimeout('STATS_GET'),
      'getProducerStats'
    );
    return stats as ProducerStat[];
  }

  /**
   * Get consumer stats
   */
  public async getConsumerStats(consumerId: string): Promise<ConsumerStat[]> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new ResourceNotFoundError('Consumer', consumerId);
    }

    const stats = await withTimeout(
      consumer.getStats(),
      this.getTimeout('STATS_GET'),
      'getConsumerStats'
    );
    return stats as ConsumerStat[];
  }
}
