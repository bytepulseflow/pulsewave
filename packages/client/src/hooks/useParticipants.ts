/**
 * useParticipants - Hook to access remote participants
 */

import { useMemo } from 'react';
import type { ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useParticipants - Hook to access remote participants
 */
export function useParticipants(): ParticipantInfo[] {
  const { participants } = useRoomContext();
  return participants;
}

/**
 * useParticipant - Hook to access a specific remote participant by SID
 */
export function useParticipant(sid: string): ParticipantInfo | undefined {
  const { participants } = useRoomContext();
  return useMemo(() => participants.find((p) => p.sid === sid), [participants, sid]);
}

/**
 * useParticipantByIdentity - Hook to access a specific remote participant by identity
 */
export function useParticipantByIdentity(identity: string): ParticipantInfo | undefined {
  const { participants } = useRoomContext();
  return useMemo(() => participants.find((p) => p.identity === identity), [participants, identity]);
}
