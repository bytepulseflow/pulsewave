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
  useMemo,
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
   * Remote participants as a Map for O(1) lookup
   */
  participants: Map<string, ParticipantInfo>;

  /**
   * Remote participants as an array (for backward compatibility)
   */
  participantsArray: ParticipantInfo[];

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
  const [participantsMap, setParticipantsMap] = useState<Map<string, ParticipantInfo>>(new Map());
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
      roomClient.on(
        'connection-state-changed',
        (state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error') => {
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
        }
      );

      roomClient.on(
        'room-joined',
        (data: {
          room: unknown;
          participant: ParticipantInfo;
          otherParticipants: ParticipantInfo[];
        }) => {
          setLocalParticipant(data.participant);
          const map = new Map<string, ParticipantInfo>();
          data.otherParticipants.forEach((p) => map.set(p.sid, p));
          setParticipantsMap(map);
        }
      );

      roomClient.on('participant-joined', (participant: ParticipantInfo) => {
        setParticipantsMap((prev) => {
          const newMap = new Map(prev);
          // Check for duplicates by SID
          if (!newMap.has(participant.sid)) {
            newMap.set(participant.sid, participant);
          }
          return newMap;
        });
      });

      roomClient.on('participant-left', (participantSid: string) => {
        setParticipantsMap((prev) => {
          const newMap = new Map(prev);
          newMap.delete(participantSid);
          return newMap;
        });
      });

      roomClient.on('error', (err: Error) => {
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
      setParticipantsMap(new Map());
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
        room.disconnect().catch((err: unknown) => {
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

  const participantsArray = useMemo(() => Array.from(participantsMap.values()), [participantsMap]);

  const value: RoomContextValue = useMemo(
    () => ({
      room,
      connectionState,
      localParticipant,
      participants: participantsMap,
      participantsArray,
      isConnecting,
      connect,
      disconnect,
      error,
    }),
    [
      room,
      connectionState,
      localParticipant,
      participantsMap,
      participantsArray,
      isConnecting,
      connect,
      disconnect,
      error,
    ]
  );

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
