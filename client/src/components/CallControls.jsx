export function CallControls({ 
  isAudioEnabled, 
  isVideoEnabled, 
  onToggleAudio, 
  onToggleVideo, 
  onHangUp 
}) {
  return (
    <div className="call-action-buttons">
      <button
        onClick={onToggleAudio}
        className={`control-btn audio-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
        title={isAudioEnabled ? 'Mute audio' : 'Unmute audio'}
      >
        <span>{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
      </button>
      <button
        onClick={onToggleVideo}
        className={`control-btn video-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
        title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
      >
        <span>{isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}</span>
      </button>
      <button
        onClick={onHangUp}
        className="control-btn hangup-btn"
        title="End call"
      >
        <span>Hang Up</span>
      </button>
    </div>
  );
}

