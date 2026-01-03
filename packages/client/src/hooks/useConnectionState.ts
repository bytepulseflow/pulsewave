/**
 * useConnectionState - Hook to access connection state
 */

import { useMemo } from 'react';
import type { ConnectionState } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useConnectionState - Hook to access connection state
 */
export function useConnectionState(): ConnectionState {
  const { connectionState } = useRoomContext();
  return connectionState;
}

/**
 * useIsConnected - Hook to check if connected
 */
export function useIsConnected(): boolean {
  const connectionState = useConnectionState();
  return useMemo(() => connectionState === 'connected', [connectionState]);
}

/**
 * useIsConnecting - Hook to check if connecting
 */
export function useIsConnecting(): boolean {
  const { isConnecting } = useRoomContext();
  return isConnecting;
}

/**
 * useIsDisconnected - Hook to check if disconnected
 */
export function useIsDisconnected(): boolean {
  const connectionState = useConnectionState();
  return useMemo(() => connectionState === 'disconnected', [connectionState]);
}

/**
 * useIsReconnecting - Hook to check if reconnecting
 */
export function useIsReconnecting(): boolean {
  const connectionState = useConnectionState();
  return useMemo(() => connectionState === 'reconnecting', [connectionState]);
}
