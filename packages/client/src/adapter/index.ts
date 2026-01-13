/**
 * Media Engine Adapter Layer - Translates signaling to media engine operations
 *
 * This layer is the ONLY place that touches media engine APIs (mediasoup). It:
 * - Translates intent-based signaling messages to media engine operations
 * - Owns reconnection logic
 * - Owns transport lifecycle
 * - Is stateful and imperative (not React-aware)
 * - Hides all media engine concepts from upper layers
 */

// New naming: MediaEngineAdapter (better abstraction)
export { MediaEngineAdapter } from './MediaEngineAdapter';
export type { MediaEngineAdapterOptions } from './MediaEngineAdapter';

// Legacy naming: MediasoupAdapter (for backward compatibility)
export { MediasoupAdapter } from './MediasoupAdapter';
export type { MediasoupAdapterOptions } from './MediasoupAdapter';

// Core orchestration logic (moved from adapter/)
export { SessionStateMachine } from '../core';
export type { SessionState, StateTransitionEvent, StateTransitionListener } from '../core';
