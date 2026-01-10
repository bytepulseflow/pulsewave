/**
 * WebRTCManager - Manages WebRTC connections using mediasoup-client
 */

import { Device, types } from 'mediasoup-client';
import type {
  RtpCapabilities,
  IceParameters,
  IceCandidate,
  DtlsParameters,
  RtpParameters,
  DataChannelKind,
  SctpParameters,
} from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

/**
 * Router capabilities (includes RTP and SCTP)
 */
interface RouterCapabilities {
  rtpCapabilities: RtpCapabilities;
}

const logger = createModuleLogger('webrtc');

// Use mediasoup-client types
type MediasoupTransport = types.Transport;
type MediasoupProducer = types.Producer;
type MediasoupConsumer = types.Consumer;
type MediasoupDataProducer = types.DataProducer;
type MediasoupDataConsumer = types.DataConsumer;

/**
 * WebRTC configuration
 */
export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: 'all' | 'relay';
}

/**
 * Transport info
 */
interface TransportInfo {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  sctpParameters?: SctpParameters;
  direction: 'send' | 'recv';
}

/**
 * Extended IceCandidate with address field for mediasoup-client compatibility
 */
interface MediasoupIceCandidate {
  foundation: string;
  priority: number;
  ip: string;
  protocol: 'udp' | 'tcp';
  port: number;
  type: 'host';
  tcpType?: 'passive';
  address: string;
}

/**
 * WebRTCManager class
 */
export class WebRTCManager {
  private device: Device | null = null;
  private sendTransport: MediasoupTransport | null = null;
  private recvTransport: MediasoupTransport | null = null;
  private producers: Map<string, MediasoupProducer> = new Map();
  private consumers: Map<string, MediasoupConsumer> = new Map();
  private dataProducers: Map<string, MediasoupDataProducer> = new Map();
  private dataConsumers: Map<string, MediasoupDataConsumer> = new Map();
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;
  private config: WebRTCConfig;

  // Track transport connection state
  private sendTransportConnected = false;
  private recvTransportConnected = false;
  private sendTransportConnectPromise: Promise<void> | null = null;
  private recvTransportConnectPromise: Promise<void> | null = null;
  private sendTransportConnectResolve: (() => void) | null = null;
  private recvTransportConnectResolve: (() => void) | null = null;
  private onTransportsConnectedCallbacks: Set<() => void> = new Set();

  constructor(
    sendFn: (message: Record<string, unknown>) => void,
    onMessage: (handler: (data: unknown) => void) => void,
    offMessage: (handler: (data: unknown) => void) => void,
    config: WebRTCConfig = {}
  ) {
    this.sendFn = sendFn;
    this.onMessage = onMessage;
    this.offMessage = offMessage;

    this.config = {
      iceServers: config.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: 'all',
      ...config,
    };
  }
  /**
   * Initialize the device
   */
  async initialize(routerCapabilities: RouterCapabilities): Promise<void> {
    this.device = new Device();

    try {
      // Convert shared types to mediasoup-client types
      // Type assertion needed because mediasoup-client has stricter type requirements
      const mediasoupRtpCapabilities = {
        codecs: (routerCapabilities.rtpCapabilities.codecs || []).map((codec) => ({
          ...codec,
          kind: codec.kind as 'audio' | 'video',
          preferredPayloadType: codec.preferredPayloadType || 0,
        })),
        headerExtensions: (routerCapabilities.rtpCapabilities.headerExtensions || []).map(
          (ext) => ({
            ...ext,
            kind: 'audio' as const,
          })
        ),
      } as types.RtpCapabilities;

      // Load device with RTP and SCTP capabilities
      await this.device.load({
        routerRtpCapabilities: mediasoupRtpCapabilities,
      });
      logger.info('Device loaded with RTP capabilities');
    } catch (error) {
      logger.error('Failed to load device', { error });
      throw new Error('Failed to initialize WebRTC device');
    }
  }

  /**
   * Create send transport
   */
  async createSendTransport(): Promise<void> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const transportInfo = await this.requestTransport('send');

    // Convert IceCandidate to include address field
    const iceCandidates: MediasoupIceCandidate[] = transportInfo.iceCandidates.map((c) => ({
      ...c,
      address: c.ip,
    }));

    this.sendTransport = this.device.createSendTransport({
      id: transportInfo.id,
      iceParameters: transportInfo.iceParameters,
      iceCandidates,
      // Type assertion needed because mediasoup-client has stricter DtlsParameters type
      dtlsParameters: transportInfo.dtlsParameters as types.DtlsParameters,
      // Pass sctpParameters if available (for data channel support)
      sctpParameters: transportInfo.sctpParameters as types.SctpParameters | undefined,
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
    });

    this.setupTransportListeners(this.sendTransport, 'send');
    logger.info('Send transport created');
  }

  /**
   * Create receive transport
   */
  async createRecvTransport(): Promise<void> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const transportInfo = await this.requestTransport('recv');

    // Convert IceCandidate to include address field
    const iceCandidates: MediasoupIceCandidate[] = transportInfo.iceCandidates.map((c) => ({
      ...c,
      address: c.ip,
    }));

    this.recvTransport = this.device.createRecvTransport({
      id: transportInfo.id,
      iceParameters: transportInfo.iceParameters,
      iceCandidates,
      // Type assertion needed because mediasoup-client has stricter DtlsParameters type
      dtlsParameters: transportInfo.dtlsParameters as types.DtlsParameters,
      // Pass sctpParameters if available (for data channel support)
      sctpParameters: transportInfo.sctpParameters as types.SctpParameters | undefined,
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
    });

    this.setupTransportListeners(this.recvTransport, 'recv');
    logger.info('Receive transport created');
  }

  /**
   * Request transport from server
   */
  private async requestTransport(direction: 'send' | 'recv'): Promise<TransportInfo> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const deviceRtpCapabilities = this.device.rtpCapabilities;

    return new Promise((resolve) => {
      const message = {
        type: 'create_transport',
        direction,
        rtpCapabilities: deviceRtpCapabilities || {},
      };

      // Set up one-time listener for response
      const handler = (data: unknown) => {
        const msg = data as Record<string, unknown>;
        if (msg.type === 'transport_created' && msg.direction === direction) {
          this.offMessage(handler);
          resolve(msg as never);
        }
      };

      this.onMessage(handler);
      this.sendFn(message);
    });
  }

  /**
   * Setup transport event listeners
   */
  private setupTransportListeners(transport: MediasoupTransport, direction: 'send' | 'recv'): void {
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
          }: { kind: string; rtpParameters: RtpParameters; appData?: Record<string, unknown> },
          callback: (data: { id: string }) => void,
          errback: (error: Error) => void
        ) => {
          try {
            const response = await this.requestProduce(transport.id, kind, rtpParameters, appData);
            callback({ id: response.id });
          } catch (error) {
            errback(error as Error);
          }
        }
      );

      // Handle producedata event - this is triggered when calling transport.produceData()
      transport.on(
        'producedata',
        async (
          {
            sctpStreamParameters,
            label,
            protocol,
            appData,
          }: {
            sctpStreamParameters: types.SctpStreamParameters;
            label?: string;
            protocol?: string;
            appData: Record<string, unknown>;
          },
          callback: (data: { id: string }) => void,
          errback: (error: Error) => void
        ) => {
          try {
            const response = await this.requestProduceData(
              transport.id,
              sctpStreamParameters,
              label,
              protocol,
              appData
            );
            callback({ id: response.id });
          } catch (error) {
            errback(error as Error);
          }
        }
      );
    }
  }

  /**
   * Request to produce a track
   */
  private async requestProduce(
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
   * Request to produce a data channel
   */
  private async requestProduceData(
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
   * Publish a track
   */
  async publishTrack(
    track: MediaStreamTrack,
    options: { source?: string } = {}
  ): Promise<MediasoupProducer> {
    if (!this.sendTransport) {
      throw new Error('Send transport not created');
    }

    const producer = await this.sendTransport.produce({
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
   * Subscribe to a track
   */
  async subscribeToTrack(producerId: string): Promise<MediasoupConsumer> {
    if (!this.recvTransport) {
      throw new Error('Receive transport not created');
    }

    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const consumerInfo = await this.requestSubscribe(this.recvTransport.id, producerId);

    const consumer = await this.recvTransport.consume({
      id: consumerInfo.id,
      producerId,
      kind: consumerInfo.kind as 'audio' | 'video',
      // Type assertion needed because mediasoup-client has stricter RtpParameters type
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
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    const deviceRtpCapabilities = this.device.rtpCapabilities;

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
   * Get all producers
   */
  getProducers(): MediasoupProducer[] {
    return Array.from(this.producers.values());
  }

  /**
   * Get all consumers
   */
  getConsumers(): MediasoupConsumer[] {
    return Array.from(this.consumers.values());
  }

  /**
   * Get a producer by ID
   */
  getProducer(id: string): MediasoupProducer | undefined {
    return this.producers.get(id);
  }

  /**
   * Get a consumer by ID
   */
  getConsumer(id: string): MediasoupConsumer | undefined {
    return this.consumers.get(id);
  }

  /**
   * Get the send transport
   */
  getSendTransport(): types.Transport | null {
    return this.sendTransport;
  }

  /**
   * Get the receive transport
   */
  getRecvTransport(): types.Transport | null {
    return this.recvTransport;
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
  ): Promise<{ id: string; dataProducer: MediasoupDataProducer }> {
    if (!this.sendTransport) {
      throw new Error('Send transport not created');
    }

    const dataProducer = await this.sendTransport.produceData({
      label: options.label,
      ordered: options.ordered !== false,
      maxPacketLifeTime: options.maxPacketLifeTime,
      maxRetransmits: options.maxRetransmits,
    });

    this.dataProducers.set(dataProducer.id, dataProducer);

    logger.info(`Data producer created: ${dataProducer.id}, kind: ${kind}`);

    // Return the DataProducer object itself - it wraps the underlying DataChannel
    return {
      id: dataProducer.id,
      dataProducer,
    };
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
  ): Promise<{ id: string; dataConsumer: MediasoupDataConsumer }> {
    if (!this.recvTransport) {
      throw new Error('Receive transport not created');
    }

    const dataConsumer = await this.recvTransport.consumeData({
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
   * Close the WebRTC manager
   */
  close(): void {
    // Clear callbacks
    this.onTransportsConnectedCallbacks.clear();

    // Close all data producers
    for (const dataProducer of this.dataProducers.values()) {
      dataProducer.close();
    }
    this.dataProducers.clear();

    // Close all data consumers
    for (const dataConsumer of this.dataConsumers.values()) {
      dataConsumer.close();
    }
    this.dataConsumers.clear();

    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Close transports
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    logger.info('WebRTC manager closed');
  }
}
