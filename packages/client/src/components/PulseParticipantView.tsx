/**
 * PulseParticipantView - Simplified component for rendering a participant with all their tracks
 *
 * Uses centralized audio analyzer for efficient resource usage.
 */

import { useMemo } from 'react';
import type { Participant, LocalParticipant } from '../types';
import { TrackSource } from '@bytepulse/pulsewave-shared';
import { PulseMediaTrack } from './PulseMediaTrack';
import { AvatarPulse } from './AvatarPulse';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';

interface PulseParticipantViewProps {
  /** The participant to render (local or remote) */
  participant: Participant | LocalParticipant;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for video elements */
  videoClassName?: string;
  /** Video object-fit property */
  objectFit?: 'contain' | 'cover' | 'fill';
  /** Show participant name */
  showIdentity?: boolean;
  /** Show "You" badge for local participant */
  showYouBadge?: boolean;
  /** Callback when video element is created */
  onVideoElement?: (element: HTMLVideoElement | null) => void;
  /** Callback when audio element is created */
  onAudioElement?: (element: HTMLAudioElement | null) => void;
  /** Speaking volume threshold (0-255) */
  speakingThreshold?: number;
}

/**
 * PulseParticipantView component - Renders a participant with all their tracks automatically
 *
 * @example
 * ```tsx
 * <PulseParticipantView participant={localParticipant} showIdentity />
 * <PulseParticipantView participant={remoteParticipant} showIdentity />
 * ```
 */
export function PulseParticipantView({
  participant,
  className = '',
  videoClassName = '',
  objectFit = 'cover',
  showIdentity = true,
  showYouBadge = true,
  onVideoElement,
  onAudioElement,
  speakingThreshold = 20,
}: PulseParticipantViewProps): JSX.Element {
  const tracks = participant.getTracks();

  const isLocal = participant.isLocal;

  // Memoize track lookups to avoid repeated iterations
  const trackInfo = useMemo(() => {
    const hasVideo = tracks.some((t) => t.kind === 'video' && t.source !== TrackSource.ScreenShare);
    const videoPublication = tracks.find(
      (t) => t.kind === 'video' && t.source !== TrackSource.ScreenShare
    );
    const audioPublication = tracks.find((t) => t.kind === 'audio');
    return { hasVideo, videoPublication, audioPublication };
  }, [tracks]);

  const { hasVideo, videoPublication, audioPublication } = trackInfo;

  // Use centralized audio analyzer for speaking detection
  const { isSpeaking } = useAudioAnalyzer({
    track: audioPublication?.track?.mediaTrack ?? null,
    speakingThreshold,
  });

  const identity = participant.identity;
  const name = participant.name || identity;

  // Memoize avatar stream to avoid recreation on every render
  const avatarStream = useMemo(() => {
    if (audioPublication?.track) {
      return new MediaStream([audioPublication.track.mediaTrack]);
    }
    return null;
  }, [audioPublication]);

  return (
    <div
      className={`pulsewave-participant ${isSpeaking ? 'pulsewave-participant--speaking' : ''} ${className}`}
    >
      <div className="pulsewave-participant__media">
        {hasVideo && videoPublication ? (
          <PulseMediaTrack
            publication={videoPublication}
            videoClassName={videoClassName}
            objectFit={objectFit}
            muted={isLocal}
            onVideoElement={onVideoElement}
          />
        ) : (
          <div className="pulsewave-participant__placeholder">
            <AvatarPulse
              stream={avatarStream}
              fallbackName={name}
              avatarUrl={participant.metadata?.avatarUrl as string | undefined}
            />
          </div>
        )}

        {/* Audio track */}
        {audioPublication && (
          <PulseMediaTrack
            publication={audioPublication}
            muted={isLocal}
            onAudioElement={onAudioElement}
          />
        )}
      </div>

      {/* Identity and badges */}
      {showIdentity && (
        <div className="pulsewave-participant__indicators">
          {!isLocal && (
            <div className="pulsewave-participant__identity">
              <span className="pulsewave-participant__name">{name}</span>
            </div>
          )}

          {showYouBadge && isLocal && (
            <span className="pulsewave-badge pulsewave-badge--you">You</span>
          )}

          {/* Mic off badge */}
          {audioPublication?.track?.isMuted && (
            <span className="pulsewave-badge pulsewave-badge--mic-off">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
