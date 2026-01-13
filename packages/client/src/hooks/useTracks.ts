/**
 * useTracks - Hooks for accessing track information
 */

import { useMemo } from 'react';
import type { TrackInfo } from '@bytepulse/pulsewave-shared';
import type { TrackKind } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useTracks - Hook to access all remote tracks
 */
export function useTracks(): TrackInfo[] {
  const { participants } = useRoomContext();

  return useMemo(() => {
    const tracks: TrackInfo[] = [];
    participants.forEach((participant) => {
      participant.tracks.forEach((track) => {
        tracks.push(track);
      });
    });
    return tracks;
  }, [participants]);
}

/**
 * useTracksByKind - Hook to access remote tracks by kind
 */
export function useTracksByKind(kind: TrackKind): TrackInfo[] {
  const tracks = useTracks();

  return useMemo(() => tracks.filter((track) => track.kind === kind), [tracks, kind]);
}

/**
 * useAudioTracks - Hook to access all remote audio tracks
 */
export function useAudioTracks(): TrackInfo[] {
  return useTracksByKind('audio' as TrackKind);
}

/**
 * useVideoTracks - Hook to access all remote video tracks
 */
export function useVideoTracks(): TrackInfo[] {
  return useTracksByKind('video' as TrackKind);
}

/**
 * useTrackPublications - Hook to access all remote track publications
 */
export function useTrackPublications(): TrackInfo[] {
  const { participants } = useRoomContext();

  return useMemo(() => {
    const publications: TrackInfo[] = [];
    participants.forEach((participant) => {
      publications.push(...participant.tracks);
    });
    return publications;
  }, [participants]);
}

/**
 * useTrackPublicationsByKind - Hook to access track publications by kind
 */
export function useTrackPublicationsByKind(kind: TrackKind): TrackInfo[] {
  const publications = useTrackPublications();

  return useMemo(() => publications.filter((pub) => pub.kind === kind), [publications, kind]);
}

/**
 * useLocalTracks - Hook to access local participant's tracks
 *
 * Returns an immutable snapshot of local tracks from React state.
 * Automatically updates when tracks are published, unpublished, muted, or unmuted.
 */
export function useLocalTracks() {
  const { localParticipant } = useRoomContext();

  return useMemo(() => {
    if (!localParticipant) {
      return { audioTracks: [], videoTracks: [], allTracks: [] };
    }

    const audioTracks = localParticipant.tracks.filter((t) => t.kind === 'audio');
    const videoTracks = localParticipant.tracks.filter((t) => t.kind === 'video');

    return { audioTracks, videoTracks, allTracks: localParticipant.tracks };
  }, [localParticipant]);
}
