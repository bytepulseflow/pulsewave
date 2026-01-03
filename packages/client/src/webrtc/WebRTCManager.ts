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
} from '@bytepulse/pulsewave-shared';

// Use mediasoup-client types
type MediasoupTransport = types.Transport;
type MediasoupProducer = types.Producer;
type MediasoupConsumer = types.Consumer;

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
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;
  private config: WebRTCConfig;

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
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: 'all',
      ...config,
    };
  }

  /**
   * Initialize the device
   */
  async initialize(rtpCapabilities: RtpCapabilities): Promise<void> {
    this.device = new Device();

    try {
      // Convert shared types to mediasoup-client types
      const mediasoupRtpCapabilities: any = {
        codecs: (rtpCapabilities.codecs || []).map((codec) => ({
          ...codec,
          kind: codec.kind as 'audio' | 'video',
        })),
        headerExtensions: (rtpCapabilities.headerExtensions || []).map((ext) => ({
          ...ext,
          kind: 'audio' as const,
        })),
      };

      await this.device.load({ routerRtpCapabilities: mediasoupRtpCapabilities });
      console.log('Device loaded with RTP capabilities');
    } catch (error) {
      console.error('Failed to load device:', error);
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
      dtlsParameters: transportInfo.dtlsParameters as any,
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
    });

    this.setupTransportListeners(this.sendTransport, 'send');
    console.log('Send transport created');
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
      dtlsParameters: transportInfo.dtlsParameters as any,
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
    });

    this.setupTransportListeners(this.recvTransport, 'recv');
    console.log('Receive transport created');
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
        _errback: (error: Error) => void
      ) => {
        this.sendFn({
          type: 'connect_transport',
          transportId: transport.id,
          dtlsParameters,
        });

        // Wait for connect confirmation (simplified - just callback)
        setTimeout(() => {
          callback();
        }, 100);
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

    console.log(`Track published: ${producer.id} (${track.kind})`);
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

      console.log(`Track unpublished: ${producerId}`);
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
      rtpParameters: consumerInfo.rtpParameters as any,
    });

    this.consumers.set(consumer.id, consumer);

    // Resume the consumer
    await this.resumeConsumer(consumer.id);

    console.log(`Track subscribed: ${consumer.id} (${consumer.kind})`);
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

      console.log(`Track unsubscribed: ${consumerId}`);
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

      console.log(`Consumer resumed: ${consumerId}`);
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
   * Close the WebRTC manager
   */
  close(): void {
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

    console.log('WebRTC manager closed');
  }
}
