import { useState, useEffect, useRef } from 'react';
import { generatePeerId } from '../webrtc/utils.js';
import { setupWebSocket } from '../webrtc/signalClient.js';
import { makeCall } from '../webrtc/calls.js';

function VideoChat() {
  const [myId, setMyId] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [peerIdInput, setPeerIdInput] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);
  const [signalingUrl, setSignalingUrl] = useState('');

  // Initialize peer ID and fetch config
  useEffect(() => {
    const id = generatePeerId();
    setMyId(id);

    // Fetch config from server
    fetch('/config.js')
      .then(res => res.text())
      .then(text => {
        // Extract SIGNALING_URL from config
        const match = text.match(/SIGNALING_URL:\s*['"]([^'"]+)['"]/);
        if (match) {
          setSignalingUrl(match[1]);
        } else {
          // Fallback
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const host = window.location.hostname;
          setSignalingUrl(`${protocol}//${host}:3001`);
        }
      })
      .catch(() => {
        // Fallback if config fetch fails
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        setSignalingUrl(`${protocol}//${host}:3001`);
      });
  }, []);

  // Start local stream
  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setStatus('Camera and microphone active');
      } catch (err) {
        console.error('Error accessing media:', err);
        setStatus('Could not access camera/microphone');
        alert('Please allow camera and microphone access');
      }
    }

    if (myId) {
      startStream();
    }
  }, [myId]);

  // Setup WebSocket when local stream is ready
  useEffect(() => {
    if (!localStream || !myId || !signalingUrl) return;

    const callbacks = {
      onStatusChange: setStatus,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state:', state);
      },
      onIncomingCall: (peerId, handleAccept) => {
        setIncomingCall({ peerId, handleAccept });
      },
      onCallDeclined: (peerId) => {
        alert(`Your call to ${peerId} was declined`);
      }
    };

    wsRef.current = setupWebSocket(myId, signalingUrl, localStream, peerConnectionRef, callbacks);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [localStream, myId, signalingUrl]);

  // Update video refs when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleCall = async () => {
    const peerId = peerIdInput.trim();
    if (!peerId) {
      alert('Enter a peer ID');
      return;
    }
    if (peerId === myId) {
      alert('Cannot call yourself');
      return;
    }

    if (!localStream) {
      alert('Camera not ready');
      return;
    }

    const callbacks = {
      onStatusChange: setStatus,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state:', state);
      },
      onIncomingCall: () => {},
      onCallDeclined: () => {}
    };

    makeCall(peerId, localStream, wsRef.current, peerConnectionRef, callbacks);
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      incomingCall.handleAccept(true);
      setIncomingCall(null);
    }
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      incomingCall.handleAccept(false);
      setIncomingCall(null);
    }
  };

  return (
    <div className="video-chat-container">
      <h1>Portal</h1>

      {/* Connection Info Section */}
      <div className="info">
        <p>
          <span className="label">Your Portal ID:</span>{' '}
          <strong>{myId || 'Loading...'}</strong>
        </p>
        <div className="call-controls">
          <input
            type="text"
            value={peerIdInput}
            onChange={(e) => setPeerIdInput(e.target.value)}
            placeholder="Enter Peer ID"
            onKeyPress={(e) => e.key === 'Enter' && handleCall()}
          />
          <button onClick={handleCall} disabled={!localStream}>
            Connect
          </button>
        </div>
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="incoming-call-modal">
          <div className="modal-content">
            <h2>Incoming Call</h2>
            <p>From: {incomingCall.peerId}</p>
            <div className="modal-buttons">
              <button onClick={handleAcceptCall} className="accept-btn">
                Accept
              </button>
              <button onClick={handleDeclineCall} className="decline-btn">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Display Section */}
      <div className="videos">
        <div className="video-container">
          <h3>Your Video</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video-element"
          />
        </div>

        <div className="video-container">
          <h3>Remote Video</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="video-element"
          />
          {!remoteStream && (
            <div className="no-video-placeholder">Waiting for connection...</div>
          )}
        </div>
      </div>

      {/* Status Display */}
      <div className="status">{status}</div>
    </div>
  );
}

export default VideoChat;

