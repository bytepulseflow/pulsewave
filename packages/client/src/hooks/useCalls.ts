/**
 * useCalls - Hook to manage call state
 */

import { useState, useCallback, useEffect } from 'react';
import type { CallInfo } from '../types';
import { useRoomContext } from '../context';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('hook:calls');

/**
 * useCalls - Hook to manage all calls state
 */
export function useCalls() {
  const { room } = useRoomContext();
  const [calls, setCalls] = useState<CallInfo[]>([]);

  useEffect(() => {
    if (!room) return;

    // Listen for call received events
    const handleCallReceived = (callInfo: CallInfo) => {
      logger.info('Call received', { callId: callInfo.callId });
      setCalls((prev) => {
        // Check for duplicates by callId
        if (prev.some((c) => c.callId === callInfo.callId)) {
          return prev;
        }
        return [...prev, callInfo];
      });
    };

    // Listen for call accepted events
    const handleCallAccepted = (callInfo: CallInfo) => {
      logger.info('Call accepted', { callId: callInfo.callId });
      setCalls((prev) =>
        prev.map((c) =>
          c.callId === callInfo.callId ? { ...c, ...callInfo, state: 'accepted' } : c
        )
      );
    };

    // Listen for call rejected events
    const handleCallRejected = (callInfo: CallInfo) => {
      logger.info('Call rejected', { callId: callInfo.callId });
      setCalls((prev) =>
        prev.map((c) =>
          c.callId === callInfo.callId ? { ...c, ...callInfo, state: 'rejected' } : c
        )
      );
    };

    // Listen for call ended events
    const handleCallEnded = (callInfo: CallInfo) => {
      logger.info('Call ended', { callId: callInfo.callId });
      setCalls((prev) =>
        prev.map((c) => (c.callId === callInfo.callId ? { ...c, ...callInfo, state: 'ended' } : c))
      );
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
