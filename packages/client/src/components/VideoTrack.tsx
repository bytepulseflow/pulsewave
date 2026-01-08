/**
 * VideoTrack - Component for rendering video tracks
 */

import { useEffect, useRef, useState } from 'react';
import type { RemoteTrack, LocalTrack } from '../types';

interface VideoTrackProps {
  track: RemoteTrack | LocalTrack;
  className?: string;
  muted?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}

/**
 * VideoTrack component - Renders a video track with modern styling
 */
export function VideoTrack({
  track,
  className = '',
  muted = false,
  objectFit = 'cover',
  onVideoElement,
}: VideoTrackProps): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

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

    // Handle video loading
    const onLoadedMetadata = (): void => {
      setIsLoaded(true);
      videoElement.play().catch((error) => {
        console.error('Failed to play video:', error);
        setHasError(true);
      });
    };

    const onError = (): void => {
      setHasError(true);
    };

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('error', onError);

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('error', onError);
      videoElement.srcObject = null;
      setIsLoaded(false);
      setHasError(false);
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
    <div className="pulsewave-video-track-wrapper">
      <video
        ref={videoRef}
        className={`pulsewave-video-track ${className} ${isLoaded ? 'loaded' : 'loading'} ${hasError ? 'error' : ''}`}
        style={{ objectFit }}
        autoPlay
        playsInline
        muted={muted}
      />
      {!isLoaded && !hasError && (
        <div className="pulsewave-video-skeleton">
          <div className="skeleton-shimmer" />
        </div>
      )}
      {hasError && (
        <div className="pulsewave-video-error">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Video unavailable</span>
        </div>
      )}
    </div>
  );
}
