/**
 * RoomContext - React context for room state management
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import type { ConnectionState, ParticipantInfo } from '@bytepulse/pulsewave-shared';
import type { RoomClientOptions } from '../client/RoomClient';
import { RoomClient } from '../client/RoomClient';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('room-context');

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
  localParticipant: ParticipantInfo | null;

  /**
   * Remote participants
   */
  participants: ParticipantInfo[];

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
  const [localParticipant, setLocalParticipant] = useState<ParticipantInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use refs to track connection state for Strict Mode compatibility
  const isConnectingRef = useRef(false);
  const isConnectedRef = useRef(false);

  // Connect to the room
  const connect = useCallback(async () => {
    // Prevent duplicate connections (important for React Strict Mode)
    if (isConnectingRef.current || isConnectedRef.current) {
      logger.debug('Connection already in progress or established, skipping');
      return;
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);

    try {
      const roomClient = new RoomClient(options);
      setRoom(roomClient);

      // Set up event listeners
      roomClient.on('connection-state-changed', (state) => {
        // Map new connection states to ConnectionState
        const mappedState =
          state === 'connected'
            ? ('connected' as ConnectionState)
            : state === 'connecting'
              ? ('connecting' as ConnectionState)
              : state === 'disconnected'
                ? ('disconnected' as ConnectionState)
                : state === 'reconnecting'
                  ? ('reconnecting' as ConnectionState)
                  : ('disconnected' as ConnectionState);
        setConnectionState(mappedState);
        onConnectionStateChanged?.(mappedState);
      });

      roomClient.on('room-joined', (data) => {
        setLocalParticipant(data.participant);
        setParticipants(data.otherParticipants);
      });

      roomClient.on('participant-joined', (participant) => {
        setParticipants((prev) => {
          // Check for duplicates by SID
          if (prev.some((p) => p.sid === participant.sid)) {
            return prev;
          }
          return [...prev, participant];
        });
      });

      roomClient.on('participant-left', (participantSid) => {
        setParticipants((prev) => prev.filter((p) => p.sid !== participantSid));
      });

      roomClient.on('error', (err) => {
        setError(err);
        onError?.(err);
      });

      await roomClient.connect();
      isConnectedRef.current = true;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      isConnectedRef.current = false;
    } finally {
      isConnectingRef.current = false;
      setIsConnecting(false);
    }
  }, [options, onConnectionStateChanged, onError]);

  // Disconnect from the room
  const disconnect = useCallback(async () => {
    if (!room || !isConnectedRef.current) {
      return;
    }

    isConnectedRef.current = false;

    try {
      await room.disconnect();
    } catch (err) {
      const error = err as Error;
      logger.error('Error disconnecting:', { error: error.message });
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
        room.disconnect().catch((err) => {
          const error = err as Error;
          logger.error('Error disconnecting on unmount:', { error: error.message });
        });
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
