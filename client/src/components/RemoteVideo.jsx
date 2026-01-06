import { useRef, useEffect } from 'react';

export function RemoteVideo({ stream, isSpeaking }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container">
      <h3>Remote Video</h3>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`video-element ${isSpeaking ? 'speaking' : ''}`}
      />
      {!stream && (
        <div className="no-video-placeholder">Waiting for connection...</div>
      )}
    </div>
  );
}

