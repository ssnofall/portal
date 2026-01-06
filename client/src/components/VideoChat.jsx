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
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const remoteAudioContextRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const remoteAnimationFrameRef = useRef(null);
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
        setIsAudioEnabled(true);
        setIsVideoEnabled(true);
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
        setIsCallActive(true);
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state:', state);
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setIsCallActive(false);
          setRemoteStream(null);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          if (state === 'failed') {
            setStatus('Connection failed');
          } else if (state === 'disconnected' || state === 'closed') {
            setStatus('Call ended');
          }
        }
      },
      onIncomingCall: (peerId, handleAccept) => {
        setIncomingCall({ peerId, handleAccept });
      },
      onCallDeclined: (peerId) => {
        alert(`Your call to ${peerId} was declined`);
        setIsCallActive(false);
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

  // Monitor audio levels for speaking indicator
  useEffect(() => {
    if (!localStream || !isAudioEnabled) {
      // Clean up if stream is removed or audio is disabled
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    // Get audio tracks
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setIsSpeaking(false);
      return;
    }

    // Set up Web Audio API for audio level monitoring
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(localStream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Monitor audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const threshold = 30; // Adjust this value to change sensitivity (0-255)
      
      const checkAudioLevel = () => {
        if (!analyserRef.current || !audioContextRef.current) {
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Update speaking state based on threshold
        setIsSpeaking(average > threshold);
        
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.error('Error setting up audio monitoring:', err);
    }

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => {
          console.error('Error closing audio context:', err);
        });
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setIsSpeaking(false);
    };
  }, [localStream, isAudioEnabled]);

  // Monitor remote audio levels for speaking indicator
  useEffect(() => {
    if (!remoteStream) {
      // Clean up if stream is removed
      if (remoteAudioContextRef.current) {
        remoteAudioContextRef.current.close();
        remoteAudioContextRef.current = null;
      }
      if (remoteAnimationFrameRef.current) {
        cancelAnimationFrame(remoteAnimationFrameRef.current);
        remoteAnimationFrameRef.current = null;
      }
      setIsRemoteSpeaking(false);
      return;
    }

    // Get audio tracks
    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setIsRemoteSpeaking(false);
      return;
    }

    // Set up Web Audio API for remote audio level monitoring
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(remoteStream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      remoteAudioContextRef.current = audioContext;
      remoteAnalyserRef.current = analyser;

      // Monitor audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const threshold = 30; // Adjust this value to change sensitivity (0-255)
      
      const checkAudioLevel = () => {
        if (!remoteAnalyserRef.current || !remoteAudioContextRef.current) {
          return;
        }

        remoteAnalyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // Update speaking state based on threshold
        setIsRemoteSpeaking(average > threshold);
        
        remoteAnimationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.error('Error setting up remote audio monitoring:', err);
    }

    // Cleanup function
    return () => {
      if (remoteAnimationFrameRef.current) {
        cancelAnimationFrame(remoteAnimationFrameRef.current);
        remoteAnimationFrameRef.current = null;
      }
      if (remoteAudioContextRef.current) {
        remoteAudioContextRef.current.close().catch(err => {
          console.error('Error closing remote audio context:', err);
        });
        remoteAudioContextRef.current = null;
      }
      remoteAnalyserRef.current = null;
      setIsRemoteSpeaking(false);
    };
  }, [remoteStream]);

  const handleCall = async () => {
    const peerId = peerIdInput.trim();
    if (!peerId) {
      alert('Enter a Portal ID');
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
        setIsCallActive(true);
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state:', state);
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setIsCallActive(false);
          setRemoteStream(null);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          if (state === 'failed') {
            setStatus('Connection failed');
          } else if (state === 'disconnected' || state === 'closed') {
            setStatus('Call ended');
          }
        }
      },
      onIncomingCall: () => {},
      onCallDeclined: (peerId) => {
        alert(`Your call to ${peerId} was declined`);
        setIsCallActive(false);
        setStatus('Call declined');
      }
    };

    makeCall(peerId, localStream, wsRef.current, peerConnectionRef, callbacks);
    // Don't set isCallActive here - wait for actual connection
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

  const handleHangUp = () => {
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      }
      peerConnectionRef.current = null;
    }

    // Clear remote stream
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Reset call state
    setIsCallActive(false);
    setStatus('Call ended');
    
    // Note: We keep the local stream active so user can make another call
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
            placeholder="Enter Portal ID"
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
            className={`video-element ${isSpeaking ? 'speaking' : ''}`}
          />
        </div>

        <div className="video-container">
          <h3>Remote Video</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`video-element ${isRemoteSpeaking ? 'speaking' : ''}`}
          />
          {!remoteStream && (
            <div className="no-video-placeholder">Waiting for connection...</div>
          )}
        </div>
      </div>

      {/* Call Control Buttons */}
      {isCallActive && (
        <div className="call-action-buttons">
          <button
            onClick={toggleAudio}
            className={`control-btn audio-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
            title={isAudioEnabled ? 'Mute audio' : 'Unmute audio'}
          >
            <span>{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>
          <button
            onClick={toggleVideo}
            className={`control-btn video-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
            title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
          >
            <span>{isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}</span>
          </button>
          <button
            onClick={handleHangUp}
            className="control-btn hangup-btn"
            title="End call"
          >
            <span>Hang Up</span>
          </button>
        </div>
      )}

      {/* Status Display */}
      <div className="status">{status}</div>
    </div>
  );
}

export default VideoChat;

