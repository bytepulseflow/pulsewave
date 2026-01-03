/**
 * VideoTrack - Component for rendering video tracks
 */

import { useEffect, useRef } from 'react';
import type { RemoteTrack, LocalTrack } from '../types';

interface VideoTrackProps {
  track: RemoteTrack | LocalTrack;
  className?: string;
  muted?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}

/**
 * VideoTrack component - Renders a video track
 */
export function VideoTrack({
  track,
  className = '',
  muted = false,
  objectFit = 'contain',
  onVideoElement,
}: VideoTrackProps): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !track) {
      return;
    }

    // Attach track to video element
    if (track.kind !== 'video') {
      console.warn('VideoTrack component received a non-video track');
      return;
    }

    const stream = new MediaStream();
    stream.addTrack(track.mediaTrack);

    videoElement.srcObject = stream;
    videoElement.muted = muted;

    // Wait for video to be ready
    const onLoadedMetadata = (): void => {
      videoElement.play().catch((error) => {
        console.error('Failed to play video:', error);
      });
    };

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.srcObject = null;
    };
  }, [track, muted]);

  useEffect(() => {
    if (onVideoElement && videoRef.current) {
      onVideoElement(videoRef.current);
    }
  }, [onVideoElement]);

  if (!track || track.kind !== 'video') {
    return null;
  }

  return (
    <video
      ref={videoRef}
      className={className}
      style={{ objectFit }}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}
