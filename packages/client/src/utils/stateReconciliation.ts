/**
 * State Reconciliation Utility
 *
 * Handles reconciliation of client state with server state after reconnection.
 * Ensures consistency between local optimistic updates and server-confirmed state.
 */

import type { ParticipantInfo, TrackInfo } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('state-reconciliation');

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  /** Whether reconciliation was successful */
  success: boolean;
  /** Tracks that were added locally but not on server */
  localOnlyTracks: TrackInfo[];
  /** Tracks that exist on server but not locally */
  serverOnlyTracks: TrackInfo[];
  /** Tracks with conflicting states */
  conflictingTracks: Array<{ local: TrackInfo; server: TrackInfo }>;
  /** Metadata differences */
  metadataDiff: {
    local: Record<string, unknown>;
    server: Record<string, unknown>;
  } | null;
}

/**
 * Reconcile participant state between local and server
 */
export function reconcileParticipantState(
  localParticipant: ParticipantInfo,
  serverParticipant: ParticipantInfo
): ReconciliationResult {
  logger.debug('Reconciling participant state', {
    localSid: localParticipant.sid,
    serverSid: serverParticipant.sid,
  });

  const result: ReconciliationResult = {
    success: false,
    localOnlyTracks: [],
    serverOnlyTracks: [],
    conflictingTracks: [],
    metadataDiff: null,
  };

  // Check if participants match
  if (localParticipant.sid !== serverParticipant.sid) {
    logger.warn('Participant SIDs do not match, cannot reconcile');
    return result;
  }

  // Reconcile tracks
  const localTrackMap = new Map(localParticipant.tracks.map((t) => [t.sid, t]));
  const serverTrackMap = new Map(serverParticipant.tracks.map((t) => [t.sid, t]));

  // Find tracks that exist locally but not on server
  for (const [sid, track] of localTrackMap.entries()) {
    if (!serverTrackMap.has(sid)) {
      result.localOnlyTracks.push(track);
    }
  }

  // Find tracks that exist on server but not locally
  for (const [sid, track] of serverTrackMap.entries()) {
    if (!localTrackMap.has(sid)) {
      result.serverOnlyTracks.push(track);
    }
  }

  // Find tracks with conflicting states
  for (const [sid, localTrack] of localTrackMap.entries()) {
    const serverTrack = serverTrackMap.get(sid);
    if (serverTrack) {
      if (
        localTrack.muted !== serverTrack.muted ||
        localTrack.width !== serverTrack.width ||
        localTrack.height !== serverTrack.height
      ) {
        result.conflictingTracks.push({ local: localTrack, server: serverTrack });
      }
    }
  }

  // Reconcile metadata
  const localMetadata = localParticipant.metadata || {};
  const serverMetadata = serverParticipant.metadata || {};
  const localMetadataKeys = new Set(Object.keys(localMetadata));
  const serverMetadataKeys = new Set(Object.keys(serverMetadata));

  const hasMetadataDiff =
    localMetadataKeys.size !== serverMetadataKeys.size ||
    [...localMetadataKeys].some((key) => {
      return JSON.stringify(localMetadata[key]) !== JSON.stringify(serverMetadata[key]);
    });

  if (hasMetadataDiff) {
    result.metadataDiff = {
      local: localMetadata,
      server: serverMetadata,
    };
  }

  // Consider reconciliation successful if there are no conflicts
  result.success = result.conflictingTracks.length === 0;

  if (result.success) {
    logger.debug('Participant state reconciled successfully', {
      localOnlyTracks: result.localOnlyTracks.length,
      serverOnlyTracks: result.serverOnlyTracks.length,
    });
  } else {
    logger.warn('Participant state has conflicts', {
      conflictingTracks: result.conflictingTracks.length,
    });
  }

  return result;
}

/**
 * Merge server state into local state
 * Returns the merged participant info
 */
export function mergeServerState(
  localParticipant: ParticipantInfo,
  serverParticipant: ParticipantInfo
): ParticipantInfo {
  const reconciliation = reconcileParticipantState(localParticipant, serverParticipant);

  // Use server state as the source of truth
  const merged: ParticipantInfo = {
    ...serverParticipant,
    // Preserve local-only optimistic updates if needed
    // For now, we prioritize server state to ensure consistency
  };

  logger.info('Merged server state into local state', {
    sid: merged.sid,
    localOnlyTracks: reconciliation.localOnlyTracks.length,
    serverOnlyTracks: reconciliation.serverOnlyTracks.length,
  });

  return merged;
}

/**
 * Generate reconciliation report
 */
export function generateReconciliationReport(reconciliation: ReconciliationResult): string {
  const lines: string[] = [];

  lines.push('=== State Reconciliation Report ===');
  lines.push(`Success: ${reconciliation.success}`);

  if (reconciliation.localOnlyTracks.length > 0) {
    lines.push(`\nLocal-only tracks (${reconciliation.localOnlyTracks.length}):`);
    reconciliation.localOnlyTracks.forEach((track) => {
      lines.push(`  - ${track.sid} (${track.kind}): ${track.source}`);
    });
  }

  if (reconciliation.serverOnlyTracks.length > 0) {
    lines.push(`\nServer-only tracks (${reconciliation.serverOnlyTracks.length}):`);
    reconciliation.serverOnlyTracks.forEach((track) => {
      lines.push(`  - ${track.sid} (${track.kind}): ${track.source}`);
    });
  }

  if (reconciliation.conflictingTracks.length > 0) {
    lines.push(`\nConflicting tracks (${reconciliation.conflictingTracks.length}):`);
    reconciliation.conflictingTracks.forEach(({ local, server }) => {
      lines.push(`  - ${local.sid}:`);
      lines.push(`    Local: muted=${local.muted}, ${local.width}x${local.height}`);
      lines.push(`    Server: muted=${server.muted}, ${server.width}x${server.height}`);
    });
  }

  if (reconciliation.metadataDiff) {
    lines.push('\nMetadata differences detected');
  }

  return lines.join('\n');
}

/**
 * State reconciliation strategy
 */
export enum ReconciliationStrategy {
  /** Prefer server state (default) */
  Server = 'server',
  /** Prefer local state (for optimistic updates) */
  Local = 'local',
  /** Merge both states */
  Merge = 'merge',
}

/**
 * Reconcile with strategy
 */
export function reconcileWithStrategy(
  localParticipant: ParticipantInfo,
  serverParticipant: ParticipantInfo,
  strategy: ReconciliationStrategy = ReconciliationStrategy.Server
): ParticipantInfo {
  switch (strategy) {
    case ReconciliationStrategy.Server:
      return mergeServerState(localParticipant, serverParticipant);

    case ReconciliationStrategy.Local:
      logger.info('Using local state as source of truth');
      return localParticipant;

    case ReconciliationStrategy.Merge:
      return mergeStates(localParticipant, serverParticipant);

    default:
      return mergeServerState(localParticipant, serverParticipant);
  }
}

/**
 * Merge both local and server states
 */
function mergeStates(
  localParticipant: ParticipantInfo,
  serverParticipant: ParticipantInfo
): ParticipantInfo {
  const reconciliation = reconcileParticipantState(localParticipant, serverParticipant);

  // Start with server state
  const merged: ParticipantInfo = {
    ...serverParticipant,
    tracks: [...serverParticipant.tracks],
  };

  // Add local-only tracks
  for (const track of reconciliation.localOnlyTracks) {
    if (!merged.tracks.find((t) => t.sid === track.sid)) {
      merged.tracks.push(track);
    }
  }

  // For conflicting tracks, prefer local state (optimistic updates)
  for (const { local } of reconciliation.conflictingTracks) {
    const index = merged.tracks.findIndex((t) => t.sid === local.sid);
    if (index !== -1) {
      merged.tracks[index] = local;
    }
  }

  // Merge metadata (local takes precedence for optimistic updates)
  if (localParticipant.metadata) {
    merged.metadata = {
      ...serverParticipant.metadata,
      ...localParticipant.metadata,
    };
  }

  logger.info('Merged local and server states', {
    sid: merged.sid,
    strategy: 'merge',
  });

  return merged;
}
