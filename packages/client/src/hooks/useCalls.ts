/**
 * useCalls - Hook to manage call state
 */

import { useState, useCallback, useEffect } from 'react';
import type { ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('hook:calls');

/**
 * Call info type
 */
export interface CallInfo {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: 'pending' | 'accepted' | 'rejected' | 'ended';
  caller?: ParticipantInfo;
  participant?: ParticipantInfo;
  metadata?: Record<string, unknown>;
}

/**
 * useCalls - Hook to manage all calls state
 */
export function useCalls() {
  const { room } = useRoomContext();
  const [calls, setCalls] = useState<CallInfo[]>([]);

  useEffect(() => {
    if (!room) return;

    // Listen for call received events
    const handleCallReceived = (data: {
      callId: string;
      caller: ParticipantInfo;
      metadata?: Record<string, unknown>;
    }) => {
      logger.info('Call received', { callId: data.callId });
      setCalls((prev) => {
        // Check for duplicates by callId
        if (prev.some((c) => c.callId === data.callId)) {
          return prev;
        }
        return [
          ...prev,
          {
            callId: data.callId,
            callerSid: data.caller.sid,
            targetSid: '', // Will be filled when we know who the target is
            state: 'pending',
            caller: data.caller,
            metadata: data.metadata,
          },
        ];
      });
    };

    // Listen for call accepted events
    const handleCallAccepted = (data: { callId: string; participant: ParticipantInfo }) => {
      logger.info('Call accepted', { callId: data.callId });
      setCalls((prev) =>
        prev.map((c) =>
          c.callId === data.callId ? { ...c, participant: data.participant, state: 'accepted' } : c
        )
      );
    };

    // Listen for call rejected events
    const handleCallRejected = (data: {
      callId: string;
      participant: ParticipantInfo;
      reason?: string;
    }) => {
      logger.info('Call rejected', { callId: data.callId });
      setCalls((prev) =>
        prev.map((c) =>
          c.callId === data.callId ? { ...c, participant: data.participant, state: 'rejected' } : c
        )
      );
    };

    // Listen for call ended events
    const handleCallEnded = (data: { callId: string; reason?: string }) => {
      logger.info('Call ended', { callId: data.callId });
      setCalls((prev) =>
        prev.map((c) => (c.callId === data.callId ? { ...c, state: 'ended' } : c))
      );
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
  }, [room]);

  /**
   * Get call by ID
   */
  const getCall = useCallback(
    (callId: string): CallInfo | undefined => {
      return calls.find((c) => c.callId === callId);
    },
    [calls]
  );

  /**
   * Get calls by state
   */
  const getCallsByState = useCallback(
    (state: CallInfo['state']): CallInfo[] => {
      return calls.filter((c) => c.state === state);
    },
    [calls]
  );

  /**
   * Get pending calls
   */
  const getPendingCalls = useCallback((): CallInfo[] => {
    return getCallsByState('pending');
  }, [getCallsByState]);

  /**
   * Get active calls
   */
  const getActiveCalls = useCallback((): CallInfo[] => {
    return calls.filter((c) => c.state === 'accepted' || c.state === 'pending');
  }, [calls]);

  /**
   * Clear all calls
   */
  const clearCalls = useCallback(() => {
    setCalls([]);
  }, []);

  /**
   * Clear calls by state
   */
  const clearCallsByState = useCallback((state: CallInfo['state']) => {
    setCalls((prev) => prev.filter((c) => c.state !== state));
  }, []);

  return {
    calls,
    getCall,
    getCallsByState,
    getPendingCalls,
    getActiveCalls,
    clearCalls,
    clearCallsByState,
  };
}
