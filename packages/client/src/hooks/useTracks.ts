/**
 * useTracks - Hooks for accessing track information
 */

import { useMemo } from 'react';
import type { RemoteTrack, RemoteTrackPublication } from '../types';
import { TrackKind } from '@bytepulse/pulsewave-shared';
import { useRoomContext } from '../context';

/**
 * useTracks - Hook to access all remote tracks
 */
export function useTracks(): RemoteTrack[] {
  const { participants } = useRoomContext();

  return useMemo(() => {
    const tracks: RemoteTrack[] = [];
    participants.forEach((participant) => {
      participant.getTracks().forEach((publication) => {
        if (publication.track) {
          tracks.push(publication.track);
        }
      });
    });
    return tracks;
  }, [participants]);
}

/**
 * useTracksByKind - Hook to access remote tracks by kind
 */
export function useTracksByKind(kind: TrackKind): RemoteTrack[] {
  const tracks = useTracks();

  return useMemo(() => tracks.filter((track) => track.kind === kind), [tracks, kind]);
}

/**
 * useAudioTracks - Hook to access all remote audio tracks
 */
export function useAudioTracks(): RemoteTrack[] {
  return useTracksByKind('audio' as TrackKind);
}

/**
 * useVideoTracks - Hook to access all remote video tracks
 */
export function useVideoTracks(): RemoteTrack[] {
  return useTracksByKind('video' as TrackKind);
}

/**
 * useTrackPublications - Hook to access all remote track publications
 */
export function useTrackPublications(): RemoteTrackPublication[] {
  const { participants } = useRoomContext();

  return useMemo(() => {
    const publications: RemoteTrackPublication[] = [];
    participants.forEach((participant) => {
      publications.push(...participant.getTracks());
    });
    return publications;
  }, [participants]);
}

/**
 * useTrackPublicationsByKind - Hook to access track publications by kind
 */
export function useTrackPublicationsByKind(kind: TrackKind): RemoteTrackPublication[] {
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
  const { localTracks } = useRoomContext();

  return useMemo(() => {
    const audioTracks = localTracks.filter((t) => t.kind === 'audio');
    const videoTracks = localTracks.filter((t) => t.kind === 'video');

    return { audioTracks, videoTracks, allTracks: localTracks };
  }, [localTracks]);
}
