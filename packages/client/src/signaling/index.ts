/**
 * Signaling Layer - Generic signaling with pluggable backends
 *
 * This layer provides intent-based signaling communication independent of
 * the underlying media engine (mediasoup). It supports pluggable transport
 * backends (WebSocket, Socket.io, etc.).
 */

export { SignalingClient } from './SignalingClient';
export type {
  SignalingClientOptions,
  SignalingClientState,
  StateChangeListener as SignalingStateChangeListener,
  MessageListener as SignalingMessageListener,
  ErrorListener as SignalingErrorListener,
} from './SignalingClient';

export type { SignalingTransport } from './transport/SignalingTransport';
export { WebSocketTransport } from './transport/WebSocketTransport';
export type {
  SignalingTransportOptions,
  SignalingTransportState,
  StateChangeListener,
  MessageListener,
  ErrorListener,
  SignalingMessage,
} from './transport/SignalingTransport';
