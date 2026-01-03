/**
 * useParticipants - Hook to access remote participants
 */

import { useMemo } from 'react';
import type { RemoteParticipant } from '../types';
import { useRoomContext } from '../context';

/**
 * useParticipants - Hook to access remote participants
 */
export function useParticipants(): RemoteParticipant[] {
  const { participants } = useRoomContext();
  return participants;
}

/**
 * useParticipant - Hook to access a specific remote participant by SID
 */
export function useParticipant(sid: string): RemoteParticipant | undefined {
  const { participants } = useRoomContext();
  return useMemo(() => participants.find((p) => p.sid === sid), [participants, sid]);
}

/**
 * useParticipantByIdentity - Hook to access a specific remote participant by identity
 */
export function useParticipantByIdentity(identity: string): RemoteParticipant | undefined {
  const { participants } = useRoomContext();
  return useMemo(() => participants.find((p) => p.identity === identity), [participants, identity]);
}
