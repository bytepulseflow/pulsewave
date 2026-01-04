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
import { ConnectionState } from '@bytepulse/pulsewave-shared';
import type {
  RoomClientOptions,
  LocalParticipant,
  RemoteParticipant,
  Participant,
  LocalTrackPublication,
} from '../types';
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
  localParticipant: LocalParticipant | null;

  /**
   * Local participant's tracks (immutable snapshot)
   */
  localTracks: LocalTrackPublication[];

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
  const [localTracks, setLocalTracks] = useState<LocalTrackPublication[]>([]);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
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
      roomClient.on('connection-state-changed', (state: ConnectionState) => {
        setConnectionState(state);
        onConnectionStateChanged?.(state);
      });

      roomClient.on('local-participant-joined', (participant: LocalParticipant) => {
        setLocalParticipant(participant);

        // Initialize local tracks from participant
        setLocalTracks([...participant.getTracks()]);

        // Set up track event listeners to sync React state
        const syncTracks = () => {
          setLocalTracks([...participant.getTracks()]);
        };

        participant.on('track-published', syncTracks as (pub: unknown) => void);
        participant.on('track-unpublished', syncTracks as (pub: unknown) => void);
        participant.on('track-muted', syncTracks as (track: unknown) => void);
        participant.on('track-unmuted', syncTracks as (track: unknown) => void);
      });

      roomClient.on('local-participant-left', () => {
        setLocalParticipant(null);
        setLocalTracks([]);
      });

      roomClient.on('participant-joined', (participant: Participant) => {
        setParticipants((prev) => {
          // Check for duplicates by SID
          if (prev.some((p) => p.sid === participant.sid)) {
            return prev;
          }
          return [...prev, participant as RemoteParticipant];
        });
      });

      roomClient.on('participant-left', (participant: Participant) => {
        setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
      });

      // Listen for track subscription events to update participants state
      roomClient.on('track-subscribed', () => {
        // Force re-render by updating participants with a new array reference
        setParticipants((prev) => [...prev]);
      });

      roomClient.on('track-unsubscribed', () => {
        // Force re-render by updating participants with a new array reference
        setParticipants((prev) => [...prev]);
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
      setLocalTracks([]);
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
    localTracks,
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
