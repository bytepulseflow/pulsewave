/**
 * useLocalParticipant - Hook to access local participant state
 */

import type { ParticipantInfo } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useLocalParticipant - Hook to access local participant state
 */
export function useLocalParticipant(): ParticipantInfo | null {
  const { localParticipant } = useRoomContext();
  return localParticipant;
}
