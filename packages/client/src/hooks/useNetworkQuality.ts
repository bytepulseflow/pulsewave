/**
 * useNetworkQuality - Hook for accessing network quality metrics
 *
 * This hook provides network quality information for the local participant.
 * Network quality is automatically tracked by the SDK and exposed through
 * the participant info.
 */

import type { NetworkQualityMetrics, ConnectionQuality } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useNetworkQuality - Hook for monitoring network quality
 *
 * Returns network quality metrics for the local participant.
 * The SDK automatically tracks network quality and updates the participant info.
 *
 * @example
 * ```tsx
 * function VideoCall() {
 *   const { metrics, quality } = useNetworkQuality();
 *
 *   return (
 *     <div>
 *       <div>Quality: {quality}</div>
 *       <div>Packet Loss: {metrics?.packetLoss.toFixed(2)}%</div>
 *       <div>RTT: {metrics?.rtt}ms</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useNetworkQuality(): {
  /** Current network quality metrics */
  metrics: NetworkQualityMetrics | null;
  /** Current connection quality level */
  quality: ConnectionQuality;
} {
  const { localParticipant } = useRoomContext();

  // Network quality metrics are embedded in participant metadata
  const networkQuality = localParticipant?.metadata?.networkQuality as
    | NetworkQualityMetrics
    | undefined;

  return {
    metrics: networkQuality ?? null,
    quality: networkQuality?.quality ?? ('excellent' as ConnectionQuality),
  };
}

/**
 * useConnectionQuality - Simplified hook for just connection quality
 *
 * @example
 * ```tsx
 * function ConnectionIndicator() {
 *   const quality = useConnectionQuality();
 *
 *   return (
 *     <div className={`quality-${quality}`}>
 *       {quality}
 *     </div>
 *   );
 * }
 * ```
 */
export function useConnectionQuality(): ConnectionQuality {
  const { quality } = useNetworkQuality();
  return quality;
}
