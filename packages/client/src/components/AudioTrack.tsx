/**
 * AudioTrack - Component for rendering audio tracks
 */

import { useEffect, useRef } from 'react';
import type { RemoteTrack, LocalTrack } from '../types';

interface AudioTrackProps {
  track: RemoteTrack | LocalTrack;
  onAudioElement?: (element: HTMLAudioElement | null) => void;
}

/**
 * AudioTrack component - Renders an audio track (typically hidden)
 */
export function AudioTrack({ track, onAudioElement }: AudioTrackProps): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !track) {
      return;
    }

    // Attach track to audio element
    if (track.kind !== 'audio') {
      console.warn('AudioTrack component received a non-audio track');
      return;
    }

    const stream = new MediaStream();
    stream.addTrack(track.mediaTrack);

    audioElement.srcObject = stream;

    return () => {
      audioElement.srcObject = null;
    };
  }, [track]);

  useEffect(() => {
    if (onAudioElement && audioRef.current) {
      onAudioElement(audioRef.current);
    }
  }, [onAudioElement]);

  if (!track || track.kind !== 'audio') {
    return null;
  }

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}
