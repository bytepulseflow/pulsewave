/**
 * Mediasoup Adapter Layer - Translates signaling to mediasoup operations
 *
 * This layer is the ONLY place that touches mediasoup APIs. It:
 * - Translates intent-based signaling messages to mediasoup operations
 * - Owns reconnection logic
 * - Owns transport lifecycle
 * - Is stateful and imperative (not React-aware)
 * - Hides all mediasoup concepts from upper layers
 */

export { MediasoupAdapter } from './MediasoupAdapter';
export type { MediasoupAdapterOptions } from './MediasoupAdapter';

export { SessionStateMachine } from './SessionStateMachine';
export type {
  SessionState,
  StateTransitionEvent,
  StateTransitionListener,
} from './SessionStateMachine';
