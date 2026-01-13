/**
 * useDataChannel - Hook for data channel functionality
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRoomContext } from '../context';

/**
 * Data message received from a participant
 */
export type DataMessage = {
  /** The raw data received (string, ArrayBuffer, or ArrayBufferView) */
  data: string | ArrayBuffer | ArrayBufferView;
  /** The participant who sent the data */
  participantSid: string;
  /** The kind of data channel used */
  kind: 'reliable' | 'lossy';
  /** Timestamp when the data was sent */
  timestamp?: number;
};

/**
 * useDataChannel - Hook for data channel functionality
 */
export function useDataChannel() {
  const { room } = useRoomContext();

  /**
   * Send data to all participants
   * @param data - The data to send (string, ArrayBuffer, ArrayBufferView, or object that will be JSON stringified)
   * @param kind - The data channel kind ('reliable' for important data, 'lossy' for real-time data)
   */
  const send = useCallback(
    async (
      data: string | ArrayBuffer | ArrayBufferView | Record<string, unknown>,
      kind: 'reliable' | 'lossy' = 'reliable'
    ) => {
      if (!room) {
        throw new Error('Room not connected');
      }

      // If data is an object, stringify it
      const payload =
        typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)
          ? JSON.stringify(data)
          : data;

      await room.sendData(payload, kind);
    },
    [room]
  );

  return { send };
}

/**
 * useDataChannelListener - Hook to listen for data channel messages
 * Automatically starts listening when called and stops when the component unmounts
 */
export function useDataChannelListener(callback: (message: DataMessage) => void) {
  const { room } = useRoomContext();
  const isListeningRef = useRef(false);

  const handleDataReceived = useCallback(
    (data: { participantSid: string; payload: unknown; kind?: 'reliable' | 'lossy' }) => {
      // Only call callback if we have valid data
      if (data.payload !== undefined && data.payload !== null) {
        callback({
          data: data.payload as string | ArrayBuffer | ArrayBufferView,
          participantSid: data.participantSid,
          kind: data.kind || 'reliable',
        });
      }
    },
    [callback]
  );

  // Automatically start listening when called
  useEffect(() => {
    if (!room || isListeningRef.current) {
      return;
    }

    isListeningRef.current = true;
    room.on('data-received', handleDataReceived as never);

    return () => {
      if (isListeningRef.current) {
        room.off('data-received', handleDataReceived as never);
        isListeningRef.current = false;
      }
    };
  }, [room, handleDataReceived]);
}
