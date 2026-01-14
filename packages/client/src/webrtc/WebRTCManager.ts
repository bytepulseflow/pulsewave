/**
 * WebRTCManager - Orchestrates WebRTC connections using mediasoup-client
 *
 * This class coordinates between the various managers to provide a unified API
 * for WebRTC operations including transport management, media publishing/subscribing,
 * and data channel management.
 */

import { types } from 'mediasoup-client';
import type { RtpCapabilities, DataChannelKind } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';
import { TransportManager, WebRTCConfig } from './TransportManager';
import { ProducerManager } from './ProducerManager';
import { ConsumerManager } from './ConsumerManager';
import { DataChannelManager } from './DataChannelManager';
import { TransportConnectionManager } from './TransportConnectionManager';

const logger = createModuleLogger('webrtc');

// Use mediasoup-client types
type MediasoupTransport = types.Transport;
type MediasoupProducer = types.Producer;
type MediasoupConsumer = types.Consumer;
type MediasoupDataProducer = types.DataProducer;
type MediasoupDataConsumer = types.DataConsumer;

/**
 * WebRTCManager class
 */
export class WebRTCManager {
  private transportManager: TransportManager;
  private producerManager: ProducerManager;
  private consumerManager: ConsumerManager;
  private dataChannelManager: DataChannelManager;
  private connectionManager: TransportConnectionManager;

  constructor(
    sendFn: (message: Record<string, unknown>) => void,
    onMessage: (handler: (data: unknown) => void) => void,
    offMessage: (handler: (data: unknown) => void) => void,
    config: WebRTCConfig = {}
  ) {
    // Initialize transport manager
    this.transportManager = new TransportManager({
      sendFn,
      onMessage,
      offMessage,
      config,
    });

    // Initialize connection manager
    this.connectionManager = new TransportConnectionManager({
      sendFn,
      onMessage,
      offMessage,
    });

    // Initialize producer manager
    this.producerManager = new ProducerManager({
      sendFn,
      onMessage,
      offMessage,
      getSendTransport: () => this.transportManager.getSendTransport(),
    });

    // Initialize consumer manager
    this.consumerManager = new ConsumerManager({
      sendFn,
      onMessage,
      offMessage,
      getRecvTransport: () => this.transportManager.getRecvTransport(),
      getDevice: () => this.transportManager.getDevice(),
    });

    // Initialize data channel manager
    this.dataChannelManager = new DataChannelManager({
      sendFn,
      onMessage,
      offMessage,
      getSendTransport: () => this.transportManager.getSendTransport(),
      getRecvTransport: () => this.transportManager.getRecvTransport(),
    });
  }

  /**
   * Initialize the device
   */
  async initialize(routerCapabilities: { rtpCapabilities: RtpCapabilities }): Promise<void> {
    await this.transportManager.initialize(routerCapabilities);
  }

  /**
   * Create send transport
   */
  async createSendTransport(): Promise<void> {
    const transport = await this.transportManager.createSendTransport();

    // Setup transport listeners with produce callbacks
    this.connectionManager.setupTransportListeners(
      transport,
      'send',
      async (params) => {
        return await this.producerManager.requestProduce(
          transport.id,
          params.kind,
          params.rtpParameters as any,
          params.appData
        );
      },
      async (params) => {
        return await this.dataChannelManager.requestProduceData(
          transport.id,
          params.sctpStreamParameters as any,
          params.label,
          params.protocol,
          params.appData
        );
      }
    );
  }

  /**
   * Create receive transport
   */
  async createRecvTransport(): Promise<void> {
    const transport = await this.transportManager.createRecvTransport();

    // Setup transport listeners (no produce callbacks for recv transport)
    this.connectionManager.setupTransportListeners(transport, 'recv');
  }

  /**
   * Publish a track
   */
  async publishTrack(
    track: MediaStreamTrack,
    options: { source?: string } = {}
  ): Promise<MediasoupProducer> {
    return await this.producerManager.publishTrack(track, options);
  }

  /**
   * Unpublish a track
   */
  async unpublishTrack(producerId: string): Promise<void> {
    await this.producerManager.unpublishTrack(producerId);
  }

  /**
   * Subscribe to a track
   */
  async subscribeToTrack(producerId: string): Promise<MediasoupConsumer> {
    return await this.consumerManager.subscribeToTrack(producerId);
  }

  /**
   * Unsubscribe from a track
   */
  async unsubscribeFromTrack(consumerId: string): Promise<void> {
    await this.consumerManager.unsubscribeFromTrack(consumerId);
  }

  /**
   * Resume a consumer
   */
  async resumeConsumer(consumerId: string): Promise<void> {
    await this.consumerManager.resumeConsumer(consumerId);
  }

  /**
   * Get all producers
   */
  getProducers(): MediasoupProducer[] {
    return this.producerManager.getProducers();
  }

  /**
   * Get all consumers
   */
  getConsumers(): MediasoupConsumer[] {
    return this.consumerManager.getConsumers();
  }

  /**
   * Get a producer by ID
   */
  getProducer(id: string): MediasoupProducer | undefined {
    return this.producerManager.getProducer(id);
  }

  /**
   * Get a consumer by ID
   */
  getConsumer(id: string): MediasoupConsumer | undefined {
    return this.consumerManager.getConsumer(id);
  }

  /**
   * Get the send transport
   */
  getSendTransport(): MediasoupTransport | null {
    return this.transportManager.getSendTransport();
  }

  /**
   * Get the receive transport
   */
  getRecvTransport(): MediasoupTransport | null {
    return this.transportManager.getRecvTransport();
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
    return await this.dataChannelManager.createDataProducer(kind, options);
  }

  /**
   * Close a data producer
   */
  async closeDataProducer(producerId: string): Promise<void> {
    await this.dataChannelManager.closeDataProducer(producerId);
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
    return await this.dataChannelManager.addDataConsumer(dataProducerId, options);
  }

  /**
   * Close a data consumer
   */
  async closeDataConsumer(consumerId: string): Promise<void> {
    await this.dataChannelManager.closeDataConsumer(consumerId);
  }

  /**
   * Register a callback to be called when both transports are connected
   */
  onTransportsConnected(callback: () => void): void {
    this.connectionManager.onTransportsConnected(callback);
  }

  /**
   * Unregister a transports connected callback
   */
  offTransportsConnected(callback: () => void): void {
    this.connectionManager.offTransportsConnected(callback);
  }

  /**
   * Wait for both transports to be connected
   */
  async waitForTransportsConnected(): Promise<void> {
    await this.connectionManager.waitForTransportsConnected();
  }

  /**
   * Check if both transports are connected
   */
  areTransportsConnected(): boolean {
    return this.connectionManager.areTransportsConnected();
  }

  /**
   * Close the WebRTC manager
   */
  close(): void {
    this.connectionManager.close();
    this.dataChannelManager.close();
    this.consumerManager.close();
    this.producerManager.close();
    this.transportManager.close();
    logger.info('WebRTC manager closed');
  }
}

// Export WebRTCConfig for external use
export type { WebRTCConfig };
