/**
 * TransportManager - Manages WebRTC transports (send/receive)
 */

import { Device, types } from 'mediasoup-client';
import type {
  RtpCapabilities,
  IceParameters,
  IceCandidate,
  DtlsParameters,
  SctpParameters,
} from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('transport-manager');

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
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  tcpType?: 'passive' | 'active' | 'so';
  address: string;
}

/**
 * WebRTC configuration
 */
export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: 'all' | 'relay';
}

/**
 * TransportManager options
 */
export interface TransportManagerOptions {
  sendFn: (message: Record<string, unknown>) => void;
  onMessage: (handler: (data: unknown) => void) => void;
  offMessage: (handler: (data: unknown) => void) => void;
  config: WebRTCConfig;
}

/**
 * TransportManager - Manages WebRTC transports
 */
export class TransportManager {
  private device: Device | null = null;
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;
  private sendFn: (message: Record<string, unknown>) => void;
  private onMessage: (handler: (data: unknown) => void) => void;
  private offMessage: (handler: (data: unknown) => void) => void;
  private config: WebRTCConfig;

  constructor(options: TransportManagerOptions) {
    this.sendFn = options.sendFn;
    this.onMessage = options.onMessage;
    this.offMessage = options.offMessage;

    this.config = {
      iceServers: options.config.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: 'all',
      ...options.config,
    };
  }

  /**
   * Initialize the device
   */
  async initialize(routerCapabilities: { rtpCapabilities: RtpCapabilities }): Promise<void> {
    this.device = new Device();

    try {
      // Convert shared types to mediasoup-client types
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

      // Load device with RTP capabilities
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
  async createSendTransport(): Promise<types.Transport> {
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
      dtlsParameters: transportInfo.dtlsParameters as types.DtlsParameters,
      sctpParameters: transportInfo.sctpParameters as types.SctpParameters | undefined,
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
    });

    logger.info('Send transport created');
    return this.sendTransport;
  }

  /**
   * Create receive transport
   */
  async createRecvTransport(): Promise<types.Transport> {
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
      dtlsParameters: transportInfo.dtlsParameters as types.DtlsParameters,
      sctpParameters: transportInfo.sctpParameters as types.SctpParameters | undefined,
      iceServers: this.config.iceServers,
      iceTransportPolicy: this.config.iceTransportPolicy,
    });

    logger.info('Receive transport created');
    return this.recvTransport;
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
   * Get send transport
   */
  getSendTransport(): types.Transport | null {
    return this.sendTransport;
  }

  /**
   * Get receive transport
   */
  getRecvTransport(): types.Transport | null {
    return this.recvTransport;
  }

  /**
   * Get device
   */
  getDevice(): Device | null {
    return this.device;
  }

  /**
   * Close all transports
   */
  close(): void {
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.device = null;
    logger.info('Transport manager closed');
  }
}
