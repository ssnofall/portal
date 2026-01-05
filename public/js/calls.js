import { createPeerConnection, peerConnection } from './connection.js';

// Handle incoming call (receiver)
export async function handleOffer(peerId, offer, localStream, ws, setStatus) {
  setStatus(`Incoming call from ${peerId}`);
  console.log('Received offer from:', peerId);

  // Ask user to accept or decline
  const accept = confirm(`Incoming call from ${peerId}. Accept?`);
  if (!accept) {
    // Notify caller that the call was declined
    const myId = document.getElementById('myId')?.textContent || 'unknown';
    ws.send(JSON.stringify({ type: 'call-declined', target: peerId, from: myId }));
    setStatus('Call declined');
    return;
  }

  // User accepted → create connection
  createPeerConnection(peerId, localStream, ws, setStatus);

  try {
    // Set the offer as remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create and set local answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send the answer back to caller
    ws.send(JSON.stringify({ type: 'answer', target: peerId, data: answer }));
    setStatus('Call accepted, connecting...');
  } catch (err) {
    console.error('Error handling offer:', err);
    setStatus('Error accepting call');
  }
}

// Handle answer to our call (caller)
export async function handleAnswer(answer, setStatus) {
  console.log('Received answer');
  if (!peerConnection) {
    console.error('No peer connection when receiving answer');
    return;
  }
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Set remote description (answer)');
    setStatus('Call accepted, connecting...');
    
    // The ontrack event should fire, but let's also check receivers as backup
    setTimeout(() => {
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo && !remoteVideo.srcObject) {
        // Check if receivers have tracks
        const receivers = peerConnection.getReceivers();
        console.log('Checking receivers after answer:', receivers.length);
        
        const tracks = receivers
          .map(r => r.track)
          .filter(t => t && (t.readyState === 'live' || t.readyState === 'ended'));
        
        if (tracks.length > 0) {
          const stream = new MediaStream(tracks);
          remoteVideo.srcObject = stream;
          console.log('Set remote video from receivers after answer:', tracks.length, 'tracks');
          setStatus('✓ Connected! Video call active');
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
              remoteVideo.srcObject = stream;
              console.log('Set remote video from receivers (delayed):', tracks.length, 'tracks');
              setStatus('✓ Connected! Video call active');
              clearInterval(checkInterval);
            } else if (attempts > 50) {
              console.warn('No tracks found after 5 seconds');
              clearInterval(checkInterval);
            }
          }, 100);
        }
      }
    }, 100);
  } catch (err) {
    console.error('Error handling answer:', err);
    setStatus('Error handling answer');
  }
}

// Handle ICE candidates
export async function handleIceCandidate(candidate) {
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
export async function makeCall(peerId, localStream, ws, setStatus) {
  setStatus('Calling...');
  console.log('Making call to:', peerId);

  // Close existing connection
  if (peerConnection) {
    peerConnection.close();
  }

  // Create a new connection
  createPeerConnection(peerId, localStream, ws, setStatus);

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send the offer to the peer
    ws.send(JSON.stringify({ type: 'offer', target: peerId, data: offer }));
  } catch (err) {
    console.error('Error making call:', err);
    setStatus('Error making call');
  }
}
