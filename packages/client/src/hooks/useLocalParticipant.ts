/**
 * useLocalParticipant - Hook to access local participant state
 */

import type { LocalParticipant } from '../types';
import { useRoomContext } from '../context';

/**
 * useLocalParticipant - Hook to access local participant state
 */
export function useLocalParticipant(): LocalParticipant | null {
  const { localParticipant } = useRoomContext();
  return localParticipant;
}
