/**
 * Mediasoup Adapter Layer - Translates application intents to mediasoup operations
 *
 * This layer is the ONLY place that touches mediasoup APIs.
 * It translates high-level application intents to low-level mediasoup operations.
 */

export { MediasoupAdapter } from './MediasoupAdapter';
export { AdapterManager } from './AdapterManager';
export { MediasoupWorker, createWorker } from './MediasoupWorker';
export type {
  MediasoupAdapterOptions,
  TransportOptions,
  ProducerOptions,
  ConsumerOptions,
} from './types';
