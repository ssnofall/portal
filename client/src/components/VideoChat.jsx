import { useState } from 'react';
import { useMediaStream } from '../hooks/useMediaStream.js';
import { useWebRTCConnection } from '../hooks/useWebRTCConnection.js';
import { useAudioMonitoring } from '../hooks/useAudioMonitoring.js';
import { LocalVideo } from './LocalVideo.jsx';
import { RemoteVideo } from './RemoteVideo.jsx';
import { CallControls } from './CallControls.jsx';
import { IncomingCallModal } from './IncomingCallModal.jsx';
import { ConnectionInfo } from './ConnectionInfo.jsx';

function VideoChat() {
  const [peerIdInput, setPeerIdInput] = useState('');

  // Media stream management
  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    status: mediaStatus,
    setStatus: setMediaStatus,
    toggleAudio,
    toggleVideo
  } = useMediaStream();

  // WebRTC connection management
  const {
    myId,
    remoteStream,
    incomingCall,
    isCallActive,
    status: connectionStatus,
    setStatus: setConnectionStatus,
    handleCall: initiateCall,
    handleAcceptCall,
    handleDeclineCall,
    handleHangUp
  } = useWebRTCConnection(localStream);

  // Audio monitoring for speaking indicators
  const isSpeaking = useAudioMonitoring(localStream, isAudioEnabled);
  const isRemoteSpeaking = useAudioMonitoring(remoteStream, true);

  // Combine status from media and connection
  const status = connectionStatus || mediaStatus;
  const setStatus = (newStatus) => {
    setConnectionStatus(newStatus);
    setMediaStatus(newStatus);
  };

  const handleCall = () => {
    const peerId = peerIdInput.trim();
    if (!peerId) {
      alert('Enter a Portal ID');
      return;
    }
    if (peerId === myId) {
      alert('Cannot call yourself');
      return;
    }
    initiateCall(peerId);
  };

  return (
    <div className="video-chat-container">
      <h1>Portal</h1>

      <ConnectionInfo
        myId={myId}
        peerIdInput={peerIdInput}
        onPeerIdChange={setPeerIdInput}
        onCall={handleCall}
        isStreamReady={!!localStream}
      />

      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />

      <div className="videos">
        <LocalVideo stream={localStream} isSpeaking={isSpeaking} />
        <RemoteVideo stream={remoteStream} isSpeaking={isRemoteSpeaking} />
      </div>

      {isCallActive && (
        <CallControls
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onHangUp={handleHangUp}
        />
      )}

      <div className="status">{status}</div>
    </div>
  );
}

export default VideoChat;

