/**
 * useCallActions - Hook for call actions (call, accept, reject)
 */

import { useCallback } from 'react';
import { useRoomContext } from '../context';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('hook:call-actions');

/**
 * useCallActions - Hook for call actions
 */
export function useCallActions() {
  const { room } = useRoomContext();

  /**
   * Initiate a call to a participant
   */
  const call = useCallback(
    async (targetParticipantSid: string, metadata?: Record<string, unknown>): Promise<void> => {
      if (!room) {
        throw new Error('Room not connected');
      }

      try {
        logger.info('Initiating call', { targetParticipantSid, metadata });
        await room.call(targetParticipantSid, metadata);
        logger.info('Call initiated successfully', { targetParticipantSid });
      } catch (error) {
        logger.error('Error initiating call', { error, targetParticipantSid });
        throw error;
      }
    },
    [room]
  );

  /**
   * Accept a call by ID
   */
  const acceptCall = useCallback(
    async (callId: string, metadata?: Record<string, unknown>): Promise<void> => {
      if (!room) {
        throw new Error('Room not connected');
      }

      try {
        logger.info('Accepting call', { callId, metadata });
        await room.acceptCall(callId, metadata);
        logger.info('Call accepted successfully', { callId });
      } catch (error) {
        logger.error('Error accepting call', { error, callId });
        throw error;
      }
    },
    [room]
  );

  /**
   * Reject a call by ID
   */
  const rejectCall = useCallback(
    async (callId: string, reason?: string): Promise<void> => {
      if (!room) {
        throw new Error('Room not connected');
      }

      try {
        logger.info('Rejecting call', { callId, reason });
        await room.rejectCall(callId, reason);
        logger.info('Call rejected successfully', { callId });
      } catch (error) {
        logger.error('Error rejecting call', { error, callId });
        throw error;
      }
    },
    [room]
  );

  /**
   * End a call by ID
   */
  const endCall = useCallback(
    async (callId: string): Promise<void> => {
      if (!room) {
        throw new Error('Room not connected');
      }

      try {
        logger.info('Ending call', { callId });
        await room.rejectCall(callId, 'Call ended');
        logger.info('Call ended successfully', { callId });
      } catch (error) {
        logger.error('Error ending call', { error, callId });
        throw error;
      }
    },
    [room]
  );

  return {
    call,
    acceptCall,
    rejectCall,
    endCall,
  };
}
