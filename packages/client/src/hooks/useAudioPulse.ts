import { useEffect, useRef } from 'react';

type AudioPulseUpdate = {
  ring1: number;
  ring2: number;
  ring3: number;
};

type UseAudioPulseOptions = {
  stream: MediaStream | null;
  onUpdate: (data: AudioPulseUpdate) => void;
};

export function useAudioPulse({ stream, onUpdate }: UseAudioPulseOptions) {
  const rafRef = useRef<number>(0);

  const ring1 = useRef(0);
  const ring2 = useRef(0);
  const ring3 = useRef(0);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);

    let smooth = 0;
    let peak = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }

      let rms = Math.sqrt(sum / data.length);
      if (rms < 0.02) rms = 0;

      smooth = smooth * 0.85 + rms * 0.15;
      peak = Math.max(smooth, peak * 0.92);

      const energy = Math.min(Math.pow(peak * 6, 1.4), 1);

      ring1.current = ring1.current * 0.55 + energy * 0.45;
      ring2.current = ring2.current * 0.7 + energy * 0.3;
      ring3.current = ring3.current * 0.85 + energy * 0.15;

      onUpdate({
        ring1: ring1.current,
        ring2: ring2.current,
        ring3: ring3.current,
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      analyser.disconnect();
      source.disconnect();
      audioContext.close();
    };
  }, [stream, onUpdate]);
}
