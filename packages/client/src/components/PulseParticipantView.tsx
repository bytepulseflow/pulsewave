/**
 * PulseParticipantView - Simplified component for rendering a participant with all their tracks
 */

import { useEffect, useState } from 'react';
import type { Participant, LocalParticipant } from '../types';
import { TrackSource } from '@bytepulse/pulsewave-shared';
import { PulseMediaTrack } from './PulseMediaTrack';
import { AvatarPulse } from './AvatarPulse';

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
}: PulseParticipantViewProps): JSX.Element {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const tracks = participant.getTracks();

  const isLocal = participant.isLocal;

  const hasVideo = tracks.some((t) => t.kind === 'video' && t.source !== TrackSource.ScreenShare);

  const videoPublication = tracks.find(
    (t) => t.kind === 'video' && t.source !== TrackSource.ScreenShare
  );

  const audioPublication = tracks.find((t) => t.kind === 'audio');

  useEffect(() => {
    if (!audioPublication?.track) return;

    const audioTrack = audioPublication.track.mediaTrack;
    if (!(audioTrack instanceof MediaStreamTrack)) return;

    let animationFrameId: number;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const setupAudioAnalysis = async () => {
      try {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const analyzeAudio = () => {
          if (!analyser) return;

          analyser.getByteFrequencyData(dataArray);

          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const averageVolume = sum / dataArray.length;

          // Speaking threshold
          const speakingThreshold = 20;
          setIsSpeaking(averageVolume > speakingThreshold);

          animationFrameId = requestAnimationFrame(analyzeAudio);
        };

        analyzeAudio();
      } catch (error) {
        console.error('Failed to setup audio analysis:', error);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (source) {
        source.disconnect();
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioPublication]);

  const identity = participant.identity;
  const name = participant.name || identity;

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
              stream={
                audioPublication?.track
                  ? new MediaStream([audioPublication.track.mediaTrack])
                  : null
              }
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
