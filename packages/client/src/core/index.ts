/**
 * Core module exports
 *
 * This module contains core orchestration logic that coordinates
 * between signaling, media engine, and services.
 */

export { SessionStateMachine } from './SessionStateMachine';
export type {
  SessionState,
  StateTransitionEvent,
  StateTransitionListener,
} from './SessionStateMachine';
