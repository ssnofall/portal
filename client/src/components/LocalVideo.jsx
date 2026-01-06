import { useRef, useEffect } from 'react';

export function LocalVideo({ stream, isSpeaking }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container">
      <h3>Your Video</h3>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`video-element ${isSpeaking ? 'speaking' : ''}`}
      />
    </div>
  );
}

