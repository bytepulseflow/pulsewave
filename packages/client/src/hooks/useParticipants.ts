/**
 * useParticipants - Hook to access remote participants
 */

import { useMemo } from 'react';
import type { ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useParticipants - Hook to access remote participants as an array
 * Returns participantsArray for backward compatibility
 */
export function useParticipants(): ParticipantInfo[] {
  const { participantsArray } = useRoomContext();
  return participantsArray;
}

/**
 * useParticipantsMap - Hook to access remote participants as a Map for O(1) lookup
 * Use this for performance-critical operations
 */
export function useParticipantsMap(): Map<string, ParticipantInfo> {
  const { participants } = useRoomContext();
  return participants;
}

/**
 * useParticipant - Hook to access a specific remote participant by SID
 * Now uses O(1) Map lookup instead of O(n) array find
 */
export function useParticipant(sid: string): ParticipantInfo | undefined {
  const { participants } = useRoomContext();
  return useMemo(() => participants.get(sid), [participants, sid]);
}

/**
 * useParticipantByIdentity - Hook to access a specific remote participant by identity
 * Still uses O(n) lookup since identity is not the Map key
 */
export function useParticipantByIdentity(identity: string): ParticipantInfo | undefined {
  const { participantsArray } = useRoomContext();
  return useMemo(
    () => participantsArray.find((p) => p.identity === identity),
    [participantsArray, identity]
  );
}
