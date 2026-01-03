/**
 * useMediaDevices - Hook for media device management
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * useMediaDevices - Hook for media device management
 */
export function useMediaDevices() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Enumerate devices
   */
  const enumerateDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
      setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
      setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
    } catch (err) {
      const error = err as Error;
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Request camera permission
   */
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      await enumerateDevices();
      return true;
    } catch {
      return false;
    }
  }, [enumerateDevices]);

  /**
   * Request microphone permission
   */
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await enumerateDevices();
      return true;
    } catch {
      return false;
    }
  }, [enumerateDevices]);

  /**
   * Request both permissions
   */
  const requestPermissions = useCallback(async (): Promise<{
    camera: boolean;
    microphone: boolean;
  }> => {
    const [camera, microphone] = await Promise.all([
      requestCameraPermission(),
      requestMicrophonePermission(),
    ]);
    return { camera, microphone };
  }, [requestCameraPermission, requestMicrophonePermission]);

  // Enumerate devices on mount
  useEffect(() => {
    enumerateDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    audioInputs,
    videoInputs,
    audioOutputs,
    isLoading,
    error,
    enumerateDevices,
    requestCameraPermission,
    requestMicrophonePermission,
    requestPermissions,
  };
}
