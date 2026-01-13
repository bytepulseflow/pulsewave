/**
 * SessionStateMachine - State machine for managing session states
 *
 * This state machine manages the deterministic reconnection logic and
 * reduces race conditions by enforcing valid state transitions.
 */

import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('session-state-machine');

/**
 * Session state
 */
export type SessionState =
  | 'idle' // Not connected, no session
  | 'joining' // Joining a room
  | 'connected' // Connected and ready
  | 'reconnecting' // Reconnecting after disconnect
  | 'closed'; // Session closed, cannot reconnect

/**
 * State transition event
 */
export type StateTransitionEvent =
  | 'connect' // Start connecting
  | 'join' // Join room
  | 'joined' // Successfully joined
  | 'disconnect' // Disconnected
  | 'reconnect' // Start reconnecting
  | 'close'; // Close session

/**
 * State transition listener
 */
export type StateTransitionListener = (
  from: SessionState,
  to: SessionState,
  event: StateTransitionEvent
) => void;

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<SessionState, Set<StateTransitionEvent>> = {
  idle: new Set(['connect']),
  joining: new Set(['joined', 'disconnect', 'close']),
  connected: new Set(['disconnect', 'close']),
  reconnecting: new Set(['joined', 'disconnect', 'close']),
  closed: new Set(), // No transitions from closed state
};

/**
 * SessionStateMachine - State machine for managing session states
 */
export class SessionStateMachine {
  private _state: SessionState = 'idle';
  private listeners: Set<StateTransitionListener> = new Set();

  /**
   * Get current state
   */
  get state(): SessionState {
    return this._state;
  }

  /**
   * Check if state is idle
   */
  isIdle(): boolean {
    return this._state === 'idle';
  }

  /**
   * Check if state is joining
   */
  isJoining(): boolean {
    return this._state === 'joining';
  }

  /**
   * Check if state is connected
   */
  isConnected(): boolean {
    return this._state === 'connected';
  }

  /**
   * Check if state is reconnecting
   */
  isReconnecting(): boolean {
    return this._state === 'reconnecting';
  }

  /**
   * Check if state is closed
   */
  isClosed(): boolean {
    return this._state === 'closed';
  }

  /**
   * Transition to a new state
   */
  transition(event: StateTransitionEvent): boolean {
    const currentState = this._state;
    const validEvents = VALID_TRANSITIONS[currentState];

    if (!validEvents.has(event)) {
      logger.warn(`Invalid state transition: ${currentState} --[${event}]--> ?`);
      return false;
    }

    const newState = this.getNextState(currentState, event);

    if (newState === currentState) {
      logger.debug(`No state change: ${currentState} --[${event}]--> ${newState}`);
      return true;
    }

    logger.info(`State transition: ${currentState} --[${event}]--> ${newState}`);
    this._state = newState;
    this.notifyListeners(currentState, newState, event);
    return true;
  }

  /**
   * Get the next state for a transition
   */
  private getNextState(currentState: SessionState, event: StateTransitionEvent): SessionState {
    switch (event) {
      case 'connect':
        return 'joining';
      case 'join':
        return 'joining';
      case 'joined':
        return 'connected';
      case 'disconnect':
        return 'idle';
      case 'reconnect':
        return 'reconnecting';
      case 'close':
        return 'closed';
      default:
        return currentState;
    }
  }

  /**
   * Register a state transition listener
   */
  onTransition(listener: StateTransitionListener): void {
    this.listeners.add(listener);
  }

  /**
   * Unregister a state transition listener
   */
  offTransition(listener: StateTransitionListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Notify all listeners of a state transition
   */
  private notifyListeners(from: SessionState, to: SessionState, event: StateTransitionEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(from, to, event);
      } catch (error) {
        logger.error('Error in state transition listener:', { error });
      }
    });
  }

  /**
   * Reset state machine to idle
   */
  reset(): void {
    const currentState = this._state;
    if (currentState !== 'idle') {
      logger.info(`Resetting state machine from ${currentState} to idle`);
      this._state = 'idle';
      this.notifyListeners(currentState, 'idle', 'disconnect');
    }
  }
}
