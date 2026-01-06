// STUN servers for public IP discovery
export const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Create a new peer connection
export function createPeerConnection(peerId, localStream, ws, callbacks) {
  const { onRemoteStream, onStatusChange, onConnectionStateChange } = callbacks;
  
  const peerConnection = new RTCPeerConnection(configuration);
  let remoteStream = new MediaStream();

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
      console.log('Set remote video from event stream');
      onRemoteStream(stream);
      onStatusChange('✓ Connected! Video call active');
    } else if (event.track) {
      // Fallback: add track to our remoteStream
      remoteStream.addTrack(event.track);
      console.log('Set remote video from track, total tracks:', remoteStream.getTracks().length);
      onRemoteStream(remoteStream);
      onStatusChange('✓ Connected! Video call active');
    }
  };

  // ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'ice-candidate',
          target: peerId,
          data: event.candidate
        }));
      } catch (err) {
        console.error('Error sending ICE candidate:', err);
      }
    } else if (!event.candidate) {
      console.log('ICE gathering complete');
    }
  };

  // ICE connection state changes
  peerConnection.oniceconnectionstatechange = () => {
    const iceState = peerConnection.iceConnectionState;
    console.log('ICE connection state:', iceState);
    if (iceState === 'failed' || iceState === 'disconnected') {
      console.warn('ICE connection issue:', iceState);
    }
  };

  // Connection state changes
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log('Connection state:', state);
    onConnectionStateChange(state);
    
    // When connected, ensure remote video is set
    if (state === 'connected' || state === 'completed') {
      onStatusChange('✓ Connected! Video call active');
      setTimeout(() => {
        // Check receivers for tracks
        const receivers = peerConnection.getReceivers();
        const tracks = receivers
          .map(r => r.track)
          .filter(t => t && t.readyState === 'live');
        
        if (tracks.length > 0) {
          // Create stream from tracks
          const stream = new MediaStream(tracks);
          console.log('Set remote video from receivers on connection:', tracks.length, 'tracks');
          onRemoteStream(stream);
        }
      }, 200);
    } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      // Don't set status here - let the component handle it
      console.log('Connection ended:', state);
    }
  };

  return peerConnection;
}
