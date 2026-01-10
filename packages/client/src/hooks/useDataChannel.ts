/**
 * useDataChannel - Hook for data channel functionality
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DataPacket } from '@bytepulse/pulsewave-shared';
import type { RemoteParticipant, RoomEvents } from '../types';
import { useRoomContext } from '../context';

/**
 * Type for data-received event data
 */
interface DataReceivedEventData {
  data: DataPacket;
  participant: RemoteParticipant;
}

/**
 * Data message received from a participant
 */
export type DataMessage = {
  /** The raw data received (string, ArrayBuffer, or ArrayBufferView) */
  data: string | ArrayBuffer | ArrayBufferView;
  /** The participant who sent the data */
  participant: RemoteParticipant;
  /** The kind of data channel used */
  kind: 'reliable' | 'lossy';
  /** Timestamp when the data was sent */
  timestamp: number;
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
    (eventData: unknown) => {
      const packet = eventData as DataReceivedEventData;

      // Extract the raw data from the DataPacket
      const rawData = packet.data.value as string | ArrayBuffer | ArrayBufferView;

      // Only call callback if we have valid data
      if (rawData !== undefined && rawData !== null) {
        callback({
          data: rawData,
          participant: packet.participant,
          kind: packet.data.kind,
          timestamp: packet.data.timestamp,
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
    room.on('data-received', handleDataReceived as RoomEvents['data-received']);

    return () => {
      if (isListeningRef.current) {
        room.off('data-received', handleDataReceived as RoomEvents['data-received']);
        isListeningRef.current = false;
      }
    };
  }, [room, handleDataReceived]);
}
