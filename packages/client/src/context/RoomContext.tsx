/**
 * RoomContext - React context for room state management
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { ConnectionState } from '@bytepulse/pulsewave-shared';
import type { RoomClientOptions, LocalParticipant, RemoteParticipant } from '../types';
import { RoomClient } from '../client/RoomClient';

/**
 * Room context interface
 */
export interface RoomContextValue {
  /**
   * Room client instance
   */
  room: RoomClient | null;

  /**
   * Connection state
   */
  connectionState: ConnectionState;

  /**
   * Local participant
   */
  localParticipant: LocalParticipant | null;

  /**
   * Remote participants
   */
  participants: RemoteParticipant[];

  /**
   * Whether currently connecting
   */
  isConnecting: boolean;

  /**
   * Connect to the room
   */
  connect: () => Promise<void>;

  /**
   * Disconnect from the room
   */
  disconnect: () => Promise<void>;

  /**
   * Error state
   */
  error: Error | null;
}

/**
 * Room context
 */
const RoomContext = createContext<RoomContextValue | null>(null);

/**
 * Room context provider props
 */
export interface RoomProviderProps {
  /**
   * Room client options
   */
  options: RoomClientOptions;

  /**
   * Children components
   */
  children: ReactNode;

  /**
   * Callback when connection state changes
   */
  onConnectionStateChanged?: (state: ConnectionState) => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Auto-connect on mount
   * @default false
   */
  autoConnect?: boolean;
}

/**
 * RoomProvider - Provides room state to children
 */
export function RoomProvider({
  options,
  children,
  onConnectionStateChanged,
  onError,
  autoConnect = false,
}: RoomProviderProps) {
  const [room, setRoom] = useState<RoomClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    'disconnected' as ConnectionState
  );
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Connect to the room
  const connect = useCallback(async () => {
    if (isConnecting || (room && connectionState === 'connected')) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const roomClient = new RoomClient(options);
      setRoom(roomClient);

      // Set up event listeners
      roomClient.on('connection-state-changed', (state: ConnectionState) => {
        setConnectionState(state);
        onConnectionStateChanged?.(state);
      });

      roomClient.on('local-participant-joined', (participant: LocalParticipant) => {
        setLocalParticipant(participant);
      });

      roomClient.on('local-participant-left', () => {
        setLocalParticipant(null);
      });

      roomClient.on('participant-joined', (participant: any) => {
        setParticipants((prev) => {
          // Check for duplicates by SID
          if (prev.some((p) => p.sid === participant.sid)) {
            return prev;
          }
          return [...prev, participant as RemoteParticipant];
        });
      });

      roomClient.on('participant-left', (participant: any) => {
        setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
      });

      roomClient.on('error', (err: Error) => {
        setError(err);
        onError?.(err);
      });

      await roomClient.connect();
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setIsConnecting(false);
    }
  }, [options, isConnecting, room, connectionState, onConnectionStateChanged, onError]);

  // Disconnect from the room
  const disconnect = useCallback(async () => {
    if (!room) {
      return;
    }

    try {
      await room.disconnect();
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setRoom(null);
      setConnectionState('disconnected' as ConnectionState);
      setLocalParticipant(null);
      setParticipants([]);
      setError(null);
    }
  }, [room]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (room) {
        room.disconnect().catch(console.error);
      }
    };
  }, [autoConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.removeAllListeners();
      }
    };
  }, [room]);

  const value: RoomContextValue = {
    room,
    connectionState,
    localParticipant,
    participants,
    isConnecting,
    connect,
    disconnect,
    error,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

/**
 * useRoomContext - Hook to access room context
 */
export function useRoomContext(): RoomContextValue {
  const context = useContext(RoomContext);

  if (!context) {
    throw new Error('useRoomContext must be used within a RoomProvider');
  }

  return context;
}

/**
 * useRoom - Alias for useRoomContext
 */
export function useRoom(): RoomContextValue {
  return useRoomContext();
}

/**
 * withRoom - HOC to provide room context to a component
 */
export function withRoom<P extends object>(Component: React.ComponentType<P>) {
  return function WrappedComponent(props: P) {
    const room = useRoomContext();
    return <Component {...props} room={room} />;
  };
}
