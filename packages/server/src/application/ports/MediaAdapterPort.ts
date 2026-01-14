/**
 * Media Adapter Port
 *
 * Port interface for media adapter operations.
 * This allows the application layer to be independent of the specific media adapter implementation.
 */

import type { Router } from 'mediasoup/types';
import type {
  ProducerOptions,
  ConsumerOptions,
  IceParameters,
  IceCandidate,
  DtlsParameters,
  RtpParameters,
} from '@bytepulse/pulsewave-shared';

/**
 * Media Adapter Port interface
 * Defines the contract for media adapter implementations
 */
export interface MediaAdapterPort {
  /**
   * Get the router for this adapter
   */
  getRouter(): Router;

  /**
   * Create a transport for sending media
   */
  createSendTransport(options: ProducerOptions): Promise<{
    id: string;
    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    dtlsParameters: DtlsParameters;
  }>;

  /**
   * Create a transport for receiving media
   */
  createRecvTransport(options: ConsumerOptions): Promise<{
    id: string;
    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    dtlsParameters: DtlsParameters;
  }>;

  /**
   * Connect a transport
   */
  connectTransport(transportId: string, dtlsParameters: DtlsParameters): Promise<void>;

  /**
   * Create a producer
   */
  createProducer(
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: RtpParameters
  ): Promise<{ id: string }>;

  /**
   * Close a producer
   */
  closeProducer(producerId: string): Promise<void>;

  /**
   * Create a consumer
   */
  createConsumer(
    transportId: string,
    producerId: string,
    rtpCapabilities: RtpParameters
  ): Promise<{
    id: string;
    producerId: string;
    kind: 'audio' | 'video';
    rtpParameters: RtpParameters;
  }>;

  /**
   * Close a consumer
   */
  closeConsumer(consumerId: string): Promise<void>;

  /**
   * Close the adapter
   */
  close(): Promise<void>;
}
