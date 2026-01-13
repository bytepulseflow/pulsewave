/**
 * Types for Mediasoup Adapter Layer
 *
 * These types are shared between client and server
 * for the adapter layer that interfaces with mediasoup.
 */

import type { TrackKind, TrackSource } from './room.types';

/**
 * Mediasoup types - re-exported from mediasoup for type safety
 * These are the actual types used by mediasoup library
 */

/**
 * ICE parameters
 */
export interface IceParameters {
  usernameFragment: string;
  password: string;
  iceLite?: boolean;
}

/**
 * ICE candidate
 * Matches mediasoup's IceCandidate type
 */
export interface IceCandidate {
  foundation: string;
  ip: string;
  port: number;
  protocol: 'udp' | 'tcp';
  priority: number;
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  tcpType?: 'active' | 'passive' | 'so';
}

/**
 * DTLS parameters
 */
export interface DtlsParameters {
  role?: 'auto' | 'client' | 'server';
  fingerprints?: { algorithm: string; value: string }[];
}

/**
 * SCTP parameters
 */
export interface SctpParameters {
  port: number;
  OS: number;
  MIS: number;
  maxMessageSize: number;
}

/**
 * RTP capabilities
 */
export interface RtpCapabilities {
  codecs?: RtpCodecCapability[];
  headerExtensions?: RtpHeaderExtension[];
}

/**
 * RTP codec capability
 */
export interface RtpCodecCapability {
  kind: 'audio' | 'video';
  mimeType: string;
  preferredPayloadType?: number;
  clockRate: number;
  channels?: number;
  parameters?: Record<string, unknown>;
  rtcpFeedback?: RtcpFeedback[];
}

/**
 * RTCP feedback
 */
export interface RtcpFeedback {
  type: string;
  parameter?: string;
}

/**
 * RTP header extension
 */
export interface RtpHeaderExtension {
  kind?: 'audio' | 'video';
  uri: string;
  preferredId: number;
  preferredEncrypt?: boolean;
  direction?: 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive';
}

/**
 * RTP parameters
 */
export interface RtpParameters {
  codecs?: RtpCodecParameters[];
  headerExtensions?: RtpHeaderExtensionParameters[];
  encodings?: RtpEncodingParameters[];
  rtcp?: RtcpParameters;
}

/**
 * RTP codec parameters
 */
export interface RtpCodecParameters {
  mimeType: string;
  payloadType: number;
  clockRate: number;
  channels?: number;
  parameters?: Record<string, unknown>;
  rtcpFeedback?: RtcpFeedback[];
}

/**
 * RTP header extension parameters
 */
export interface RtpHeaderExtensionParameters {
  uri: string;
  id: number;
  encrypt?: boolean;
  parameters?: Record<string, unknown>;
}

/**
 * RTP encoding parameters
 */
export interface RtpEncodingParameters {
  ssrc?: number;
  rid?: string;
  codecPayloadType?: number;
  rtx?: { ssrc: number };
  dtx?: boolean;
  scalabilityMode?: string;
  scaleResolutionDownBy?: number;
}

/**
 * RTCP parameters
 */
export interface RtcpParameters {
  cname?: string;
  reducedSize?: boolean;
}

/**
 * SCTP stream parameters
 */
export interface SctpStreamParameters {
  streamId?: number;
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  priority?: number;
  label?: string;
  protocol?: string;
}

/**
 * Producer stats
 */
export interface ProducerStat {
  type: string;
  timestamp: number;
  ssrc?: number;
  bitrate?: number;
  byteCount?: number;
  packetCount?: number;
  packetLost?: number;
  fractionLost?: number;
  jitter?: number;
  rtt?: number;
}

/**
 * Consumer stats
 */
export interface ConsumerStat {
  type: string;
  timestamp: number;
  ssrc?: number;
  bitrate?: number;
  byteCount?: number;
  packetCount?: number;
  packetLost?: number;
  fractionLost?: number;
  jitter?: number;
  rtt?: number;
}

/**
 * Transport options
 */
export interface TransportOptions {
  direction: 'send' | 'recv';
  enableUdp?: boolean;
  enableTcp?: boolean;
  preferUdp?: boolean;
  enableSctp?: boolean;
}

/**
 * Producer options
 */
export interface ProducerOptions {
  kind: TrackKind;
  source: TrackSource;
  rtpParameters?: RtpParameters;
  paused?: boolean;
  codecOptions?: Record<string, unknown>;
  appData?: Record<string, unknown>;
}

/**
 * Consumer options
 */
export interface ConsumerOptions {
  producerId: string;
  rtpCapabilities?: RtpCapabilities;
  paused?: boolean;
  preferCodecs?: RtpCodecParameters[];
  appData?: Record<string, unknown>;
}

/**
 * Data producer options
 */
export interface DataProducerOptions {
  sctpStreamParameters?: SctpStreamParameters;
  label?: string;
  protocol?: string;
  appData?: Record<string, unknown>;
}

/**
 * Data consumer options
 */
export interface DataConsumerOptions {
  dataProducerId: string;
  sctpStreamParameters?: SctpStreamParameters;
  appData?: Record<string, unknown>;
}

/**
 * Transport info
 */
export interface TransportInfo {
  id: string;
  direction: 'send' | 'recv';
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  sctpParameters?: SctpParameters;
}

/**
 * Producer info
 */
export interface ProducerInfo {
  id: string;
  kind: TrackKind;
  source: TrackSource;
  paused: boolean;
}

/**
 * Consumer info
 */
export interface ConsumerInfo {
  id: string;
  producerId: string;
  kind: TrackKind;
  paused: boolean;
  rtpParameters?: RtpParameters;
}

/**
 * Data producer info
 */
export interface DataProducerInfo {
  id: string;
  label?: string;
  protocol?: string;
}

/**
 * Data consumer info
 */
export interface DataConsumerInfo {
  id: string;
  dataProducerId: string;
}

/**
 * Media Adapter Interface
 *
 * Defines the contract for media adapters (e.g., MediasoupAdapter)
 * This allows for pluggable media backends.
 */
export interface MediaAdapter {
  /**
   * Create a WebRTC transport
   */
  createTransport(options: TransportOptions): Promise<TransportInfo>;

  /**
   * Connect a transport
   */
  connectTransport(transportId: string, dtlsParameters: DtlsParameters): Promise<void>;

  /**
   * Create a producer (publish a track)
   */
  createProducer(transportId: string, options: ProducerOptions): Promise<ProducerInfo>;

  /**
   * Create a consumer (subscribe to a track)
   */
  createConsumer(transportId: string, options: ConsumerOptions): Promise<ConsumerInfo>;

  /**
   * Pause a producer
   */
  pauseProducer(producerId: string): Promise<void>;

  /**
   * Resume a producer
   */
  resumeProducer(producerId: string): Promise<void>;

  /**
   * Close a producer
   */
  closeProducer(producerId: string): Promise<void>;

  /**
   * Pause a consumer
   */
  pauseConsumer(consumerId: string): Promise<void>;

  /**
   * Resume a consumer
   */
  resumeConsumer(consumerId: string): Promise<void>;

  /**
   * Close a consumer
   */
  closeConsumer(consumerId: string): Promise<void>;

  /**
   * Create a data producer
   */
  createDataProducer(transportId: string, options: DataProducerOptions): Promise<DataProducerInfo>;

  /**
   * Create a data consumer
   */
  createDataConsumer(transportId: string, options: DataConsumerOptions): Promise<DataConsumerInfo>;

  /**
   * Close a data producer
   */
  closeDataProducer(dataProducerId: string): Promise<void>;

  /**
   * Close a data consumer
   */
  closeDataConsumer(dataConsumerId: string): Promise<void>;

  /**
   * Close a transport
   */
  closeTransport(transportId: string): Promise<void>;

  /**
   * Close all resources
   */
  close(): Promise<void>;

  /**
   * Get router RTP capabilities
   */
  getRtpCapabilities(): RtpCapabilities;

  /**
   * Get producer stats
   */
  getProducerStats(producerId: string): Promise<ProducerStat[]>;

  /**
   * Get consumer stats
   */
  getConsumerStats(consumerId: string): Promise<ConsumerStat[]>;
}
