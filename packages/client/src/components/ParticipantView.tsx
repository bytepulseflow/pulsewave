/**
 * ParticipantView - Component for rendering a participant with their tracks
 */

import { useEffect, useState } from 'react';
import type { Participant, TrackPublication } from '../types';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('participant-view');

interface ParticipantViewProps {
  participant: Participant;
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  showAudioIndicator?: boolean;
  showIdentity?: boolean;
  showSpeakingIndicator?: boolean;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}

/**
 * SpeakingIndicator - Visual indicator for when participant is speaking
 */
function SpeakingIndicator({ isSpeaking }: { isSpeaking: boolean }): JSX.Element {
  return (
    <div
      className={`pulsewave-speaking-indicator ${isSpeaking ? 'pulsewave-speaking-indicator--active' : ''}`}
    >
      <div className="pulsewave-speaking-indicator__bars">
        <span className="pulsewave-speaking-indicator__bar" />
        <span className="pulsewave-speaking-indicator__bar" />
        <span className="pulsewave-speaking-indicator__bar" />
        <span className="pulsewave-speaking-indicator__bar" />
      </div>
    </div>
  );
}

/**
 * ParticipantView component - Renders a participant with their tracks
 */
export function ParticipantView({
  participant,
  className = '',
  videoClassName = '',
  objectFit = 'contain',
  showAudioIndicator = true,
  showIdentity = true,
  showSpeakingIndicator = true,
  onVideoElement,
}: ParticipantViewProps): JSX.Element | null {
  const [tracks, setTracks] = useState(() => participant.getTracks());
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Update tracks when participant changes or when tracks are updated
  useEffect(() => {
    const updateTracks = () => {
      const currentTracks = participant.getTracks();
      logger.debug('Updating tracks for participant:', {
        identity: participant.identity,
        tracks: currentTracks.map((t) => ({
          sid: t.sid,
          kind: t.kind,
          hasTrack: !!t.track,
          subscribed: t.subscribed,
        })),
      });
      setTracks(currentTracks);
    };

    // Initial update
    updateTracks();

    // Listen for track changes
    const handleTrackPublished = (publication: TrackPublication) => {
      logger.debug('Track published event:', { sid: publication.sid });
      updateTracks();
    };

    const handleTrackSubscribed = (publication: TrackPublication) => {
      const hasTrack = 'track' in publication && publication.track !== null;
      logger.debug('Track subscribed event:', {
        sid: publication.sid,
        hasTrack,
      });
      updateTracks();
    };

    const handleTrackUnpublished = () => {
      logger.debug('Track unpublished event');
      updateTracks();
    };

    participant.on('track-published', handleTrackPublished);
    participant.on('track-subscribed', handleTrackSubscribed);
    participant.on('track-unpublished', handleTrackUnpublished);

    return () => {
      participant.off('track-published', handleTrackPublished);
      participant.off('track-subscribed', handleTrackSubscribed);
      participant.off('track-unpublished', handleTrackUnpublished);
    };
  }, [participant]);

  // Detect speaking state from audio track
  useEffect(() => {
    const audioTrack = tracks.find((t) => t.track && t.track.kind === 'audio' && !t.track.isMuted);
    if (!audioTrack || !audioTrack.track) {
      setIsSpeaking(false);
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(
      new MediaStream([audioTrack.track.mediaTrack])
    );

    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let speakingTimeout: ReturnType<typeof setTimeout> | null = null;

    const checkSpeaking = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const threshold = 10; // Adjust based on sensitivity

      if (average > threshold) {
        setIsSpeaking(true);
        if (speakingTimeout) {
          clearTimeout(speakingTimeout);
        }
        speakingTimeout = setTimeout(() => setIsSpeaking(false), 500);
      }

      requestAnimationFrame(checkSpeaking);
    };

    checkSpeaking();

    return () => {
      if (speakingTimeout) {
        clearTimeout(speakingTimeout);
      }
      source.disconnect();
      audioContext.close();
    };
  }, [tracks]);

  // Derive video and audio tracks from current tracks state
  const videoTracks = tracks
    .filter((t) => t.track && t.track.kind === 'video')
    .map((t) => ({ track: t.track, sid: t.sid }));
  const audioTracks = tracks
    .filter((t) => t.track && t.track.kind === 'audio')
    .map((t) => ({ track: t.track, sid: t.sid }));

  logger.debug('Render', {
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
  });

  const hasAudio = audioTracks.length > 0;
  const isAudioMuted = hasAudio && audioTracks.some((t) => t.track?.isMuted);

  if (!participant) {
    return null;
  }

  const displayName = participant.name || participant.identity;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`pulsewave-participant ${className} ${isSpeaking ? 'pulsewave-participant--speaking' : ''}`}
    >
      {/* Video/placeholder container */}
      <div className="pulsewave-participant__media">
        {videoTracks.length > 0 ? (
          <div className="pulsewave-participant__video">
            {videoTracks.map(({ track, sid }) => {
              if (!track) return null;
              return (
                <VideoTrack
                  key={sid}
                  track={track}
                  className={videoClassName}
                  objectFit={objectFit}
                  onVideoElement={onVideoElement}
                />
              );
            })}
          </div>
        ) : (
          <div className="pulsewave-participant__placeholder">
            <div className="pulsewave-avatar pulsewave-avatar--large">
              <span className="pulsewave-avatar__initials">{initials}</span>
            </div>
            <div className="pulsewave-participant__placeholder-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
        )}

        {/* Audio tracks (hidden) */}
        {audioTracks.map(({ track, sid }) => {
          if (!track) return null;
          return <AudioTrack key={sid} track={track} />;
        })}

        {/* Status indicators */}
        <div className="pulsewave-participant__indicators">
          {/* Speaking indicator */}
          {showSpeakingIndicator && hasAudio && !isAudioMuted && (
            <SpeakingIndicator isSpeaking={isSpeaking} />
          )}

          {/* Audio mute indicator */}
          {showAudioIndicator && hasAudio && isAudioMuted && (
            <div className="pulsewave-badge pulsewave-badge--mic-off">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
          )}

          {/* Connection status indicator */}
          <div className="pulsewave-badge pulsewave-badge--connection">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>
        </div>
      </div>

      {/* Identity display */}
      {showIdentity && (
        <div className="pulsewave-participant__identity">
          <span className="pulsewave-participant__name">{displayName}</span>
          {isSpeaking && <span className="pulsewave-participant__speaking-label">Speaking</span>}
        </div>
      )}
    </div>
  );
}
