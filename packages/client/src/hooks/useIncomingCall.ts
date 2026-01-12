/**
 * useIncomingCall - Hook to handle incoming calls
 */

import { useState, useCallback, useEffect } from 'react';
import type { CallInfo } from '../types';
import { useRoomContext } from '../context';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('hook:incoming-call');

/**
 * useIncomingCall - Hook to handle incoming calls
 */
export function useIncomingCall() {
  const { room } = useRoomContext();
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);

  useEffect(() => {
    if (!room) return;

    // Listen for call received events
    const handleCallReceived = (callInfo: CallInfo) => {
      logger.info('Incoming call received', {
        callId: callInfo.callId,
        caller: callInfo.callerSid,
      });
      setIncomingCall(callInfo);
    };

    // Listen for call accepted events (to clear incoming call if accepted)
    const handleCallAccepted = (callInfo: CallInfo) => {
      if (incomingCall?.callId === callInfo.callId) {
        logger.info('Incoming call accepted', { callId: callInfo.callId });
        setIncomingCall(null);
      }
    };

    // Listen for call rejected events (to clear incoming call if rejected)
    const handleCallRejected = (callInfo: CallInfo) => {
      if (incomingCall?.callId === callInfo.callId) {
        logger.info('Incoming call rejected', { callId: callInfo.callId });
        setIncomingCall(null);
      }
    };

    // Listen for call ended events (to clear incoming call if ended)
    const handleCallEnded = (callInfo: CallInfo) => {
      if (incomingCall?.callId === callInfo.callId) {
        logger.info('Incoming call ended', { callId: callInfo.callId });
        setIncomingCall(null);
      }
    };

    room.on('call-received', handleCallReceived);
    room.on('call-accepted', handleCallAccepted);
    room.on('call-rejected', handleCallRejected);
    room.on('call-ended', handleCallEnded);

    return () => {
      room.off('call-received', handleCallReceived);
      room.off('call-accepted', handleCallAccepted);
      room.off('call-rejected', handleCallRejected);
      room.off('call-ended', handleCallEnded);
    };
  }, [room, incomingCall]);

  /**
   * Accept the incoming call
   */
  const acceptCall = useCallback(
    async (metadata?: Record<string, unknown>): Promise<void> => {
      if (!incomingCall) {
        throw new Error('No incoming call to accept');
      }
      if (!room) {
        throw new Error('Room not connected');
      }

      try {
        logger.info('Accepting incoming call', { callId: incomingCall.callId });
        await room.acceptCall(incomingCall.callId, metadata);
      } catch (error) {
        logger.error('Error accepting call', { error, callId: incomingCall.callId });
        throw error;
      }
    },
    [incomingCall, room]
  );

  /**
   * Reject the incoming call
   */
  const rejectCall = useCallback(
    async (reason?: string): Promise<void> => {
      if (!incomingCall) {
        throw new Error('No incoming call to reject');
      }
      if (!room) {
        throw new Error('Room not connected');
      }

      try {
        logger.info('Rejecting incoming call', { callId: incomingCall.callId, reason });
        await room.rejectCall(incomingCall.callId, reason);
      } catch (error) {
        logger.error('Error rejecting call', { error, callId: incomingCall.callId });
        throw error;
      }
    },
    [incomingCall, room]
  );

  /**
   * Clear the incoming call (e.g., after handling it)
   */
  const clearIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return {
    incomingCall,
    hasIncomingCall: !!incomingCall,
    acceptCall,
    rejectCall,
    clearIncomingCall,
  };
}
