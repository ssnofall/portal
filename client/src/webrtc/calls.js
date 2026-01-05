import { createPeerConnection } from './connection.js';

// Handle incoming call (receiver)
export async function handleOffer(peerId, offer, localStream, ws, peerConnectionRef, callbacks) {
  const { onStatusChange, onIncomingCall } = callbacks;
  
  onStatusChange(`Incoming call from ${peerId}`);
  console.log('Received offer from:', peerId);

  // Notify component about incoming call - component will handle accept/decline
  onIncomingCall(peerId, async (accept) => {
    if (!accept) {
      // Notify caller that the call was declined
      ws.send(JSON.stringify({ type: 'call-declined', target: peerId }));
      onStatusChange('Call declined');
      return;
    }

    // User accepted → create connection
    const peerConnection = createPeerConnection(peerId, localStream, ws, callbacks);
    peerConnectionRef.current = peerConnection;

    try {
      // Set the offer as remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and set local answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send the answer back to caller
      ws.send(JSON.stringify({ type: 'answer', target: peerId, data: answer }));
      onStatusChange('Call accepted, connecting...');
    } catch (err) {
      console.error('Error handling offer:', err);
      onStatusChange('Error accepting call');
    }
  });
}

// Handle answer to our call (caller)
export async function handleAnswer(answer, peerConnection, callbacks) {
  const { onStatusChange, onRemoteStream } = callbacks;
  
  console.log('Received answer');
  if (!peerConnection) {
    console.error('No peer connection when receiving answer');
    return;
  }
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Set remote description (answer)');
    onStatusChange('Call accepted, connecting...');
    
    // The ontrack event should fire, but let's also check receivers as backup
    setTimeout(() => {
      // Check if receivers have tracks
      const receivers = peerConnection.getReceivers();
      console.log('Checking receivers after answer:', receivers.length);
      
      const tracks = receivers
        .map(r => r.track)
        .filter(t => t && (t.readyState === 'live' || t.readyState === 'ended'));
      
      if (tracks.length > 0) {
        const stream = new MediaStream(tracks);
        console.log('Set remote video from receivers after answer:', tracks.length, 'tracks');
        onRemoteStream(stream);
        onStatusChange('✓ Connected! Video call active');
      } else {
        // Set up periodic check
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          const receivers = peerConnection.getReceivers();
          const tracks = receivers
            .map(r => r.track)
            .filter(t => t && (t.readyState === 'live' || t.readyState === 'ended'));
          
          if (tracks.length > 0) {
            const stream = new MediaStream(tracks);
            console.log('Set remote video from receivers (delayed):', tracks.length, 'tracks');
            onRemoteStream(stream);
            onStatusChange('✓ Connected! Video call active');
            clearInterval(checkInterval);
          } else if (attempts > 50) {
            console.warn('No tracks found after 5 seconds');
            clearInterval(checkInterval);
          }
        }, 100);
      }
    }, 100);
  } catch (err) {
    console.error('Error handling answer:', err);
    onStatusChange('Error handling answer');
  }
}

// Handle ICE candidates
export async function handleIceCandidate(candidate, peerConnection) {
  if (!peerConnection) return;
  try {
    if (candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (err) {
    console.error('Error adding ICE candidate:', err);
  }
}

// Start a call (caller)
export async function makeCall(peerId, localStream, ws, peerConnectionRef, callbacks) {
  const { onStatusChange } = callbacks;
  
  onStatusChange('Calling...');
  console.log('Making call to:', peerId);

  // Close existing connection if any
  if (peerConnectionRef.current) {
    peerConnectionRef.current.close();
  }

  // Create a new connection
  const peerConnection = createPeerConnection(peerId, localStream, ws, callbacks);
  peerConnectionRef.current = peerConnection;

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send the offer to the peer
    ws.send(JSON.stringify({ type: 'offer', target: peerId, data: offer }));
  } catch (err) {
    console.error('Error making call:', err);
    onStatusChange('Error making call');
  }
}
