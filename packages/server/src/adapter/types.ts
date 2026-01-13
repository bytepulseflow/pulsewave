/**
 * Types for Mediasoup Adapter Layer
 *
 * Server-specific adapter types that extend shared types.
 */

import type { Router } from 'mediasoup/types';
import type {
  MediaAdapter,
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
  DtlsParameters,
  RtpCapabilities,
  ProducerStat,
  ConsumerStat,
  IceParameters,
} from '@bytepulse/pulsewave-shared';

// Re-export shared types
export type {
  MediaAdapter,
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
  DtlsParameters,
  RtpCapabilities,
  ProducerStat,
  ConsumerStat,
  IceParameters,
};

/**
 * Mediasoup adapter options (server-specific)
 */
export interface MediasoupAdapterOptions {
  router: Router;
  enableUdp?: boolean;
  enableTcp?: boolean;
  preferUdp?: boolean;
  enableSctp?: boolean;
  listenIps: { ip: string; announcedIp?: string }[];
  initialAvailableOutgoingBitrate?: number;
  minimumAvailableOutgoingBitrate?: number;
}
