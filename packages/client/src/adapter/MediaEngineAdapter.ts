/**
 * MediaEngineAdapter - Adapter layer that translates signaling to media engine operations
 *
 * This is the ONLY place that touches media engine APIs (mediasoup). It:
 * - Translates intent-based signaling messages to media engine operations
 * - Owns reconnection logic
 * - Owns transport lifecycle
 * - Is stateful and imperative (not React-aware)
 * - Hides all media engine concepts from upper layers
 */

import type { SignalingClient } from '../signaling/SignalingClient';
import type { RtpCapabilities, DataChannelKind } from '@bytepulse/pulsewave-shared';
import { WebRTCManager } from '../webrtc/WebRTCManager';
import type { types } from 'mediasoup-client';
import { SessionStateMachine, SessionState } from '../core';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('media-engine-adapter');

/**
 * Media engine adapter options
 */
export interface MediaEngineAdapterOptions {
  /**
   * Signaling client for communication
   */
  signalingClient: SignalingClient;

  /**
   * RTP capabilities for WebRTC
   */
  rtpCapabilities: RtpCapabilities;

  /**
   * Callback when session state changes
   */
  onStateChange?: (state: SessionState) => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback when track is published
   */
  onTrackPublished?: (producerId: string, trackSid: string) => void;

  /**
   * Callback when track is unpublished
   */
  onTrackUnpublished?: (trackSid: string) => void;

  /**
   * Callback when track is subscribed
   */
  onTrackSubscribed?: (consumerId: string, trackSid: string) => void;

  /**
   * Callback when track is unsubscribed
   */
  onTrackUnsubscribed?: (trackSid: string) => void;

  /**
   * Callback when transport is connected
   */
  onTransportConnected?: () => void;

  /**
   * Callback when transport is created
   */
  onTransportCreated?: (transportId: string, direction: 'send' | 'recv') => void;
}

/**
 * MediaEngineAdapter - Adapter layer that translates signaling to media engine operations
 */
export class MediaEngineAdapter {
  private webRTCManager: WebRTCManager | null = null;
  private stateMachine: SessionStateMachine;
  private messageHandlers: Set<(data: unknown) => void> = new Set();
  private producers: Map<string, types.Producer> = new Map();
  private consumers: Map<string, types.Consumer> = new Map();
  private dataProducers: Map<string, types.DataProducer> = new Map();
  private dataConsumers: Map<string, types.DataConsumer> = new Map();

  constructor(private readonly options: MediaEngineAdapterOptions) {
    // Initialize state machine
    this.stateMachine = new SessionStateMachine();
    this.stateMachine.onTransition((from, to, event) => {
      logger.debug(`State transition: ${from} -> ${to} (${event})`);
      this.options.onStateChange?.(to);
    });

    // Wire up signaling client
    this.setupSignalingClient();
  }

  /**
   * Get current session state
   */
  get state(): SessionState {
    return this.stateMachine.state;
  }

  /**
   * Initialize the adapter (start session)
   */
  async initialize(): Promise<void> {
    if (!this.stateMachine.isIdle()) {
      throw new Error('Adapter already initialized');
    }

    this.stateMachine.transition('connect');

    try {
      // Initialize WebRTC manager
      this.webRTCManager = new WebRTCManager(
        (message) => this.options.signalingClient.send(message),
        (handler) => this.messageHandlers.add(handler),
        (handler) => this.messageHandlers.delete(handler)
      );

      await this.webRTCManager.initialize({
        rtpCapabilities: this.options.rtpCapabilities,
      });

      // Create send and receive transports
      await this.webRTCManager.createSendTransport();
      await this.webRTCManager.createRecvTransport();

      this.stateMachine.transition('joined');
      logger.info('Media engine adapter initialized');
    } catch (error) {
      this.stateMachine.transition('disconnect');
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Close the adapter (end session)
   */
  close(): void {
    if (this.stateMachine.isClosed()) {
      return;
    }

    this.stateMachine.transition('close');

    // Close all data consumers
    this.dataConsumers.forEach((consumer) => {
      try {
        consumer.close();
      } catch (error) {
        logger.error('Error closing data consumer:', { error });
      }
    });
    this.dataConsumers.clear();

    // Close all data producers
    this.dataProducers.forEach((producer) => {
      try {
        producer.close();
      } catch (error) {
        logger.error('Error closing data producer:', { error });
      }
    });
    this.dataProducers.clear();

    // Close all consumers
    this.consumers.forEach((consumer) => {
      try {
        consumer.close();
      } catch (error) {
        logger.error('Error closing consumer:', { error });
      }
    });
    this.consumers.clear();

    // Close all producers
    this.producers.forEach((producer) => {
      try {
        producer.close();
      } catch (error) {
        logger.error('Error closing producer:', { error });
      }
    });
    this.producers.clear();

    // Close WebRTC manager
    if (this.webRTCManager) {
      this.webRTCManager.close();
      this.webRTCManager = null;
    }

    this.messageHandlers.clear();
    logger.info('Media engine adapter closed');
  }

  /**
   * Publish a track
   */
  async publishTrack(
    track: MediaStreamTrack,
    options: { source: string }
  ): Promise<{ producerId: string; trackSid: string }> {
    if (!this.stateMachine.isConnected()) {
      throw new Error('Cannot publish track: not connected');
    }

    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    const producer = await this.webRTCManager.publishTrack(track, options);
    const producerId = producer.id;
    const trackSid = `track_${producerId}`;

    this.producers.set(producerId, producer);

    logger.info('Track published:', { producerId, trackSid, kind: track.kind });
    this.options.onTrackPublished?.(producerId, trackSid);

    return { producerId, trackSid };
  }

  /**
   * Unpublish a track
   */
  async unpublishTrack(producerId: string, trackSid: string): Promise<void> {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer not found: ${producerId}`);
    }

    await this.webRTCManager?.unpublishTrack(producerId);
    this.producers.delete(producerId);

    logger.info('Track unpublished:', { producerId, trackSid });
    this.options.onTrackUnpublished?.(trackSid);
  }

  /**
   * Subscribe to a track
   */
  async subscribeToTrack(producerId: string): Promise<{ consumerId: string; trackSid: string }> {
    if (!this.stateMachine.isConnected()) {
      throw new Error('Cannot subscribe to track: not connected');
    }

    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    const consumer = await this.webRTCManager.subscribeToTrack(producerId);
    const consumerId = consumer.id;
    const trackSid = `track_${consumerId}`;

    this.consumers.set(consumerId, consumer);

    logger.info('Track subscribed:', { consumerId, trackSid, producerId });
    this.options.onTrackSubscribed?.(consumerId, trackSid);

    return { consumerId, trackSid };
  }

  /**
   * Unsubscribe from a track
   */
  async unsubscribeFromTrack(consumerId: string, trackSid: string): Promise<void> {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer not found: ${consumerId}`);
    }

    await this.webRTCManager?.unsubscribeFromTrack(consumerId);
    this.consumers.delete(consumerId);

    logger.info('Track unsubscribed:', { consumerId, trackSid });
    this.options.onTrackUnsubscribed?.(trackSid);
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
    if (!this.stateMachine.isConnected()) {
      throw new Error('Cannot create data producer: not connected');
    }

    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    const result = await this.webRTCManager.createDataProducer(kind, options);
    this.dataProducers.set(result.id, result.dataProducer);

    logger.info('Data producer created:', { id: result.id, label: options.label });
    return result;
  }

  /**
   * Close a data producer
   */
  async closeDataProducer(producerId: string): Promise<void> {
    const producer = this.dataProducers.get(producerId);
    if (!producer) {
      throw new Error(`Data producer not found: ${producerId}`);
    }

    await this.webRTCManager?.closeDataProducer(producerId);
    this.dataProducers.delete(producerId);

    logger.info('Data producer closed:', { producerId });
  }

  /**
   * Add a data consumer
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
    if (!this.stateMachine.isConnected()) {
      throw new Error('Cannot add data consumer: not connected');
    }

    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    const result = await this.webRTCManager.addDataConsumer(dataProducerId, options);
    this.dataConsumers.set(result.id, result.dataConsumer);

    logger.info('Data consumer added:', { id: result.id, label: options.label });
    return result;
  }

  /**
   * Close a data consumer
   */
  async closeDataConsumer(consumerId: string): Promise<void> {
    const consumer = this.dataConsumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Data consumer not found: ${consumerId}`);
    }

    await this.webRTCManager?.closeDataConsumer(consumerId);
    this.dataConsumers.delete(consumerId);

    logger.info('Data consumer closed:', { consumerId });
  }

  /**
   * Get a consumer by ID
   */
  getConsumer(consumerId: string): types.Consumer | undefined {
    return this.consumers.get(consumerId);
  }

  /**
   * Get a producer by ID
   */
  getProducer(producerId: string): types.Producer | undefined {
    return this.producers.get(producerId);
  }

  /**
   * Get a data consumer by ID
   */
  getDataConsumer(consumerId: string): types.DataConsumer | undefined {
    return this.dataConsumers.get(consumerId);
  }

  /**
   * Get a data producer by ID
   */
  getDataProducer(producerId: string): types.DataProducer | undefined {
    return this.dataProducers.get(producerId);
  }

  /**
   * Get message handlers for wiring
   */
  getMessageHandlers(): Set<(data: unknown) => void> {
    return this.messageHandlers;
  }

  /**
   * Setup signaling client message handlers
   */
  private setupSignalingClient(): void {
    this.options.signalingClient.onMessage((message) => {
      // Route message to WebRTC handlers
      this.messageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          logger.error('Error in message handler:', { error });
        }
      });
    });

    this.options.signalingClient.onError((error) => {
      logger.error('Signaling error:', { error });
      this.options.onError?.(error);
    });

    this.options.signalingClient.onStateChange((state) => {
      logger.debug('Signaling state changed:', { state });

      // Handle signaling state changes
      if (state === 'reconnecting' && this.stateMachine.isConnected()) {
        this.stateMachine.transition('reconnect');
      } else if (state === 'connected' && this.stateMachine.isReconnecting()) {
        this.stateMachine.transition('joined');
      } else if (state === 'error' && !this.stateMachine.isClosed()) {
        this.stateMachine.transition('disconnect');
      }
    });
  }
}
