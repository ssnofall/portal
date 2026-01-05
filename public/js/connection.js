export let peerConnection = null;
let remoteStream = null;

export function getRemoteStream() {
  return remoteStream;
}

// STUN servers for public IP discovery
export const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Create a new peer connection
export function createPeerConnection(peerId, localStream, ws, setStatus) {
  // Close existing connection if any
  if (peerConnection) {
    peerConnection.close();
  }
  
  peerConnection = new RTCPeerConnection(configuration);
  remoteStream = new MediaStream();
  
  // Clear any existing remote video
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle remote tracks - this is the key event
  peerConnection.ontrack = (event) => {
    console.log('ontrack event fired:', event.track.kind, event.streams.length);
    
    // Use the stream from the event if available, otherwise use our remoteStream
    if (event.streams && event.streams.length > 0) {
      // Use the stream from the event
      const stream = event.streams[0];
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = stream;
        console.log('Set remote video from event stream');
        setStatus('✓ Connected! Video call active');
      }
    } else if (event.track) {
      // Fallback: add track to our remoteStream
      remoteStream.addTrack(event.track);
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
        console.log('Set remote video from track, total tracks:', remoteStream.getTracks().length);
        setStatus('✓ Connected! Video call active');
      }
    }
  };

  // ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        target: peerId,
        data: event.candidate
      }));
    }
  };

  // Connection state changes
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log('Connection state:', state);
    setStatus(`Connection state: ${state}`);
    
    // When connected, ensure remote video is set
    if (state === 'connected' || state === 'completed') {
      setTimeout(() => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && !remoteVideo.srcObject) {
          // Check receivers for tracks
          const receivers = peerConnection.getReceivers();
          const tracks = receivers
            .map(r => r.track)
            .filter(t => t && t.readyState === 'live');
          
          if (tracks.length > 0) {
            // Create stream from tracks
            const stream = new MediaStream(tracks);
            remoteVideo.srcObject = stream;
            console.log('Set remote video from receivers on connection:', tracks.length, 'tracks');
            setStatus('✓ Connected! Video call active');
          }
        }
      }, 200);
    }
  };

  return peerConnection;
}
