import { useState, useEffect } from 'react';

export function useMediaStream() {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        setLocalStream(stream);
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
        setStatus('Camera and microphone active');
      } catch (err) {
        console.error('Error accessing media:', err);
        setStatus('Could not access camera/microphone');
        alert('Please allow camera and microphone access');
      }
    }

    startStream();
  }, []);

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsAudioEnabled(newState);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsVideoEnabled(newState);
      }
    }
  };

  return {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    status,
    setStatus,
    toggleAudio,
    toggleVideo
  };
}

