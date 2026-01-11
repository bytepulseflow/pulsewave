/**
 * Centralized Audio Analyzer Hook
 *
 * Provides a single source of truth for audio analysis data across all components.
 * Uses a shared AudioContext and analyzer per track to avoid resource duplication.
 */

import { useEffect, useState, useMemo } from 'react';

export type AudioAnalysisData = {
  /** Average volume level (0-255) */
  volume: number;
  /** Whether the audio is above speaking threshold */
  isSpeaking: boolean;
  /** Energy level for pulse visualization (0-1) */
  energy: number;
  /** Ring values for pulse animation */
  rings: {
    ring1: number;
    ring2: number;
    ring3: number;
  };
};

type AudioAnalyzerState = {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
  animationFrameId: number | null;
  subscribers: Set<(data: AudioAnalysisData) => void>;
  lastData: AudioAnalysisData;
};

// Global registry of audio analyzers by track ID
const analyzerRegistry = new Map<string, AudioAnalyzerState>();

/**
 * Get or create an audio analyzer for a given track
 */
function getOrCreateAnalyzer(trackId: string): AudioAnalyzerState {
  let state = analyzerRegistry.get(trackId);

  if (!state) {
    state = {
      audioContext: null,
      analyser: null,
      source: null,
      animationFrameId: null,
      subscribers: new Set(),
      lastData: {
        volume: 0,
        isSpeaking: false,
        energy: 0,
        rings: { ring1: 0, ring2: 0, ring3: 0 },
      },
    };
    analyzerRegistry.set(trackId, state);
  }

  return state;
}

/**
 * Start audio analysis for a track
 */
function startAnalysis(
  state: AudioAnalyzerState,
  track: MediaStreamTrack,
  speakingThreshold: number
): void {
  if (state.audioContext) {
    // Already running
    return;
  }

  try {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    source.connect(analyser);

    state.audioContext = audioContext;
    state.analyser = analyser;
    state.source = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const timeDomainData = new Uint8Array(analyser.fftSize);

    // Smooth values for ring animation
    let smooth = 0;
    let peak = 0;

    const analyze = () => {
      if (!state.analyser) return;

      // Get frequency data for volume
      state.analyser.getByteFrequencyData(dataArray);

      // Get time domain data for pulse visualization
      state.analyser.getByteTimeDomainData(timeDomainData);

      // Calculate average volume from frequency data
      const sum = dataArray.reduce((acc, val) => acc + val, 0);
      const volume = sum / dataArray.length;

      // Calculate RMS from time domain data
      let rmsSum = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        const v = (timeDomainData[i] - 128) / 128;
        rmsSum += v * v;
      }
      let rms = Math.sqrt(rmsSum / timeDomainData.length);
      if (rms < 0.02) rms = 0;

      // Smooth values
      smooth = smooth * 0.85 + rms * 0.15;
      peak = Math.max(smooth, peak * 0.92);

      // Calculate energy for pulse
      const energy = Math.min(Math.pow(peak * 6, 1.4), 1);

      // Calculate ring values with different smoothing
      const ring1 = state.lastData.rings.ring1 * 0.55 + energy * 0.45;
      const ring2 = state.lastData.rings.ring2 * 0.7 + energy * 0.3;
      const ring3 = state.lastData.rings.ring3 * 0.85 + energy * 0.15;

      const data: AudioAnalysisData = {
        volume,
        isSpeaking: volume > speakingThreshold,
        energy,
        rings: { ring1, ring2, ring3 },
      };

      state.lastData = data;

      // Notify all subscribers
      state.subscribers.forEach((subscriber) => {
        try {
          subscriber(data);
        } catch (error) {
          console.error('Error in audio analysis subscriber:', error);
        }
      });

      state.animationFrameId = requestAnimationFrame(analyze);
    };

    analyze();
  } catch (error) {
    console.error('Failed to start audio analysis:', error);
  }
}

/**
 * Stop audio analysis for a track
 */
function stopAnalysis(state: AudioAnalyzerState): void {
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  if (state.source) {
    state.source.disconnect();
    state.source = null;
  }

  if (state.analyser) {
    state.analyser = null;
  }

  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
}

/**
 * Subscribe to audio analysis updates
 */
function subscribe(
  state: AudioAnalyzerState,
  callback: (data: AudioAnalysisData) => void
): () => void {
  state.subscribers.add(callback);

  // Immediately send last known data
  if (state.lastData) {
    callback(state.lastData);
  }

  // Return unsubscribe function
  return () => {
    state.subscribers.delete(callback);

    // If no more subscribers, stop analysis
    if (state.subscribers.size === 0) {
      stopAnalysis(state);
    }
  };
}

interface UseAudioAnalyzerOptions {
  /** The audio track to analyze */
  track: MediaStreamTrack | null;
  /** Speaking volume threshold (0-255) */
  speakingThreshold?: number;
}

/**
 * Centralized audio analyzer hook
 *
 * Provides audio analysis data for a track, sharing the analysis across all components.
 *
 * @example
 * ```tsx
 * const { volume, isSpeaking, energy, rings } = useAudioAnalyzer({ track: audioTrack });
 * ```
 */
export function useAudioAnalyzer({
  track,
  speakingThreshold = 20,
}: UseAudioAnalyzerOptions): AudioAnalysisData {
  const [data, setData] = useState<AudioAnalysisData>({
    volume: 0,
    isSpeaking: false,
    energy: 0,
    rings: { ring1: 0, ring2: 0, ring3: 0 },
  });

  const trackId = useMemo(() => (track ? track.id : ''), [track]);

  useEffect(() => {
    if (!track) return;

    const state = getOrCreateAnalyzer(trackId);

    // Start analysis if not already running
    if (!state.audioContext) {
      startAnalysis(state, track, speakingThreshold);
    }

    // Subscribe to updates
    const unsubscribe = subscribe(state, setData);

    return () => {
      unsubscribe();
    };
  }, [track, trackId, speakingThreshold]);

  return data;
}

/**
 * Cleanup all audio analyzers (call on app unmount)
 */
export function cleanupAllAudioAnalyzers(): void {
  analyzerRegistry.forEach((state) => {
    stopAnalysis(state);
    state.subscribers.clear();
  });
  analyzerRegistry.clear();
}
