/**
 * useIncomingCall - Hook to handle incoming calls
 */

import { useState, useCallback, useEffect } from 'react';
import type { ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('hook:incoming-call');

/**
 * Call info type
 */
export interface CallInfo {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: 'pending' | 'accepted' | 'rejected' | 'ended';
  caller?: ParticipantInfo;
  metadata?: Record<string, unknown>;
}

/**
 * useIncomingCall - Hook to handle incoming calls
 */
export function useIncomingCall() {
  const { room } = useRoomContext();
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);

  useEffect(() => {
    if (!room) return;

    // Listen for call received events
    const handleCallReceived = (data: {
      callId: string;
      caller: ParticipantInfo;
      metadata?: Record<string, unknown>;
    }) => {
      logger.info('Incoming call received', {
        callId: data.callId,
        caller: data.caller.sid,
      });
      setIncomingCall({
        callId: data.callId,
        callerSid: data.caller.sid,
        targetSid: '',
        state: 'pending',
        caller: data.caller,
        metadata: data.metadata,
      });
    };

    // Listen for call accepted events (to clear incoming call if accepted)
    const handleCallAccepted = (data: { callId: string; participant: ParticipantInfo }) => {
      if (incomingCall?.callId === data.callId) {
        logger.info('Incoming call accepted', { callId: data.callId });
        setIncomingCall(null);
      }
    };

    // Listen for call rejected events (to clear incoming call if rejected)
    const handleCallRejected = (data: {
      callId: string;
      participant: ParticipantInfo;
      reason?: string;
    }) => {
      if (incomingCall?.callId === data.callId) {
        logger.info('Incoming call rejected', { callId: data.callId });
        setIncomingCall(null);
      }
    };

    // Listen for call ended events (to clear incoming call if ended)
    const handleCallEnded = (data: { callId: string; reason?: string }) => {
      if (incomingCall?.callId === data.callId) {
        logger.info('Incoming call ended', { callId: data.callId });
        setIncomingCall(null);
      }
    };

    room.on('call-received', handleCallReceived as never);
    room.on('call-accepted', handleCallAccepted as never);
    room.on('call-rejected', handleCallRejected as never);
    room.on('call-ended', handleCallEnded as never);

    return () => {
      room.off('call-received', handleCallReceived as never);
      room.off('call-accepted', handleCallAccepted as never);
      room.off('call-rejected', handleCallRejected as never);
      room.off('call-ended', handleCallEnded as never);
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
