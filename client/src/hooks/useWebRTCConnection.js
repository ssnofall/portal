import { useState, useEffect, useRef } from 'react';
import { generatePeerId } from '../webrtc/utils.js';
import { setupWebSocket } from '../webrtc/signalClient.js';
import { makeCall } from '../webrtc/calls.js';

export function useWebRTCConnection(localStream) {
  const [myId, setMyId] = useState('');
  const [signalingUrl, setSignalingUrl] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [status, setStatus] = useState('Initializing...');

  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);

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

  // Setup WebSocket when local stream is ready
  useEffect(() => {
    if (!localStream || !myId || !signalingUrl) return;

    const callbacks = {
      onStatusChange: setStatus,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        setIsCallActive(true);
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state:', state);
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setIsCallActive(false);
          setRemoteStream(null);
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


  const handleCall = async (peerId) => {
    if (!localStream) {
      alert('Camera not ready');
      return;
    }

    const callbacks = {
      onStatusChange: setStatus,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        setIsCallActive(true);
      },
      onConnectionStateChange: (state) => {
        console.log('Connection state:', state);
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setIsCallActive(false);
          setRemoteStream(null);
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

    // Reset call state
    setIsCallActive(false);
    setStatus('Call ended');
  };

  return {
    myId,
    remoteStream,
    incomingCall,
    isCallActive,
    status,
    setStatus,
    peerConnectionRef,
    handleCall,
    handleAcceptCall,
    handleDeclineCall,
    handleHangUp
  };
}

