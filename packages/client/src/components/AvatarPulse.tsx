import { useState, useEffect } from 'react';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import './avatar.css';

type Props = {
  /** Audio track for pulse visualization (optional if rings are provided) */
  audioTrack?: MediaStreamTrack | null;
  /** Pre-calculated ring values (optional, will be calculated from audioTrack if not provided) */
  rings?: {
    ring1: number;
    ring2: number;
    ring3: number;
  };
  avatarUrl?: string;
  fallbackName?: string;
};

export function AvatarPulse({ audioTrack, rings: ringsProp, avatarUrl, fallbackName }: Props) {
  const [rings, setRings] = useState({
    ring1: 0,
    ring2: 0,
    ring3: 0,
  });

  // Use centralized audio analyzer if rings not provided
  const { rings: analyzerRings } = useAudioAnalyzer({
    track: audioTrack ?? null,
    speakingThreshold: 20,
  });

  // Update rings from analyzer or props
  useEffect(() => {
    if (ringsProp) {
      setRings(ringsProp);
    } else if (analyzerRings) {
      setRings(analyzerRings);
    }
  }, [ringsProp, analyzerRings]);

  if (!audioTrack && !ringsProp) {
    return (
      <div>
        {avatarUrl ? (
          <>
            <img src={avatarUrl} className="avatar" />
          </>
        ) : (
          <>
            <div className="avatar">
              {fallbackName ? fallbackName.charAt(0).toUpperCase() : '?'}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pulse-root">
      <div className="ring ring-1" style={{ '--energy': rings.ring1 } as React.CSSProperties} />
      <div className="ring ring-2" style={{ '--energy': rings.ring2 } as React.CSSProperties} />
      <div className="ring ring-3" style={{ '--energy': rings.ring3 } as React.CSSProperties} />
      {avatarUrl ? (
        <>
          <img src={avatarUrl} className="avatar" />
        </>
      ) : (
        <>
          <div className="avatar">{fallbackName ? fallbackName.charAt(0).toUpperCase() : '?'}</div>
        </>
      )}
    </div>
  );
}
