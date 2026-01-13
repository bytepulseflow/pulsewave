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
 * AudioTrack component - Renders an audio track
 */
export function AudioTrack({ track, onAudioElement }: AudioTrackProps): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !track) {
      return;
    }

    if (track.kind !== 'audio') {
      console.warn('AudioTrack component received a non-audio track');
      return;
    }

    const stream = new MediaStream();
    stream.addTrack(track.mediaTrack);
    streamRef.current = stream;

    audioElement.srcObject = stream;

    return () => {
      // Clear srcObject
      audioElement.srcObject = null;

      // Stop all tracks in the stream to release resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((mediaTrack) => {
          mediaTrack.stop();
        });
        streamRef.current = null;
      }
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

  return (
    <div className="pulsewave-audio-track-wrapper">
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
