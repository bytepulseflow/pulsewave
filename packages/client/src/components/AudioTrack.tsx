/**
 * AudioTrack - Component for rendering audio tracks
 */

import { useEffect, useRef } from 'react';
import type { RemoteTrack, LocalTrack } from '../types';
import './styles.css';
interface AudioTrackProps {
  track: RemoteTrack | LocalTrack;
  onAudioElement?: (element: HTMLAudioElement | null) => void;
  showVisualizer?: boolean;
}

/**
 * AudioTrack component - Renders an audio track with optional visualizer
 */
export function AudioTrack({
  track,
  onAudioElement,
  showVisualizer = false,
}: AudioTrackProps): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

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

  // Audio visualizer effect
  useEffect(() => {
    if (!showVisualizer || !track || !canvasRef.current) {
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(new MediaStream([track.mediaTrack]));

    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw bars
      const barWidth = canvas.width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#a855f7');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      source.disconnect();
      audioContext.close();
    };
  }, [showVisualizer, track]);

  if (!track || track.kind !== 'audio') {
    return null;
  }

  return (
    <div className="pulsewave-audio-track-wrapper">
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      {showVisualizer && (
        <div className="pulsewave-audio-visualizer">
          <canvas ref={canvasRef} width={200} height={40} />
        </div>
      )}
    </div>
  );
}
