/**
 * useDataChannel - Hook for data channel functionality
 */

import { useCallback } from 'react';
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
 * useDataChannel - Hook for data channel functionality
 */
export function useDataChannel() {
  const { room } = useRoomContext();

  /**
   * Send data to all participants
   */
  const sendData = useCallback(
    async (data: unknown, kind: 'reliable' | 'lossy' = 'reliable') => {
      if (!room) {
        throw new Error('Room not connected');
      }
      await room.sendData(data, kind);
    },
    [room]
  );

  return {
    sendData,
  };
}

/**
 * useDataChannelListener - Hook to listen for data channel messages
 */
export function useDataChannelListener(
  callback: (data: DataPacket, participant: RemoteParticipant) => void
) {
  const { room } = useRoomContext();

  // Note: This is a simplified implementation
  // In a real implementation, you would set up event listeners
  // and clean them up on unmount

  const handleDataReceived = useCallback(
    (eventData: unknown) => {
      const data = eventData as DataReceivedEventData;
      callback(data.data, data.participant);
    },
    [callback]
  );

  return {
    startListening: () => {
      if (!room) {
        return;
      }
      room.on('data-received', handleDataReceived as RoomEvents['data-received']);
    },
    stopListening: () => {
      if (!room) {
        return;
      }
      room.off('data-received', handleDataReceived as RoomEvents['data-received']);
    },
  };
}
