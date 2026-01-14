/**
 * useOptimisticUpdates - Hook for optimistic state updates
 *
 * Provides a pattern for optimistic updates to make the UI feel instant.
 * Updates are applied immediately and rolled back if the server rejects the change.
 */

import { useCallback, useRef } from 'react';

/**
 * Optimistic update options
 */
export interface OptimisticUpdateOptions<T> {
  /** The optimistic value to apply immediately */
  optimisticValue: T;
  /** Function to apply the actual server value */
  applyActualValue: (value: T) => Promise<void>;
  /** Function to rollback to the original value if update fails */
  rollback: (originalValue: T) => void;
}

/**
 * useOptimisticUpdates - Hook for optimistic state updates
 *
 * This hook provides a pattern for optimistic updates. It doesn't directly
 * manipulate participant state because the current architecture only exposes
 * ParticipantInfo to React components, not the actual participant instance.
 *
 * Components should use this pattern with their own state management.
 *
 * @example
 * ```tsx
 * function MuteButton() {
 *   const { optimisticUpdate } = useOptimisticUpdates();
 *   const [isMuted, setIsMuted] = useState(false);
 *   const room = useRoom();
 *
 *   const handleMute = async () => {
 *     const originalMuted = isMuted;
 *
 *     await optimisticUpdate({
 *       optimisticValue: true,
 *       applyActualValue: async (muted) => {
 *         // Apply the optimistic value to UI immediately
 *         setIsMuted(muted);
 *
 *         // Then call the server
 *         if (muted) {
 *           await room?.room?.muteAudio();
 *         } else {
 *           await room?.room?.unmuteAudio();
 *         }
 *       },
 *       rollback: (originalValue) => {
 *         // Rollback UI to original value
 *         setIsMuted(originalValue);
 *       },
 *     });
 *   };
 *
 *   return <button onClick={handleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>;
 * }
 * ```
 */
export function useOptimisticUpdates() {
  const pendingUpdatesRef = useRef<Map<string, unknown>>(new Map());

  /**
   * Perform an optimistic update
   */
  const optimisticUpdate = useCallback(
    async <T>(options: OptimisticUpdateOptions<T>): Promise<void> => {
      const { optimisticValue, applyActualValue, rollback } = options;
      const updateId = Date.now().toString();

      // Store the update for tracking
      pendingUpdatesRef.current.set(updateId, optimisticValue);

      try {
        // Apply the optimistic value immediately
        await applyActualValue(optimisticValue);
      } catch (error) {
        // Rollback if the update fails
        rollback(optimisticValue);
        pendingUpdatesRef.current.delete(updateId);
        throw error;
      } finally {
        // Clean up the update reference
        pendingUpdatesRef.current.delete(updateId);
      }
    },
    []
  );

  /**
   * Check if there are any pending updates
   */
  const hasPendingUpdates = useCallback((): boolean => {
    return pendingUpdatesRef.current.size > 0;
  }, []);

  return {
    optimisticUpdate,
    hasPendingUpdates,
  };
}
