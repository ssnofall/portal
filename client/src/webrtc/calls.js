import { createPeerConnection } from './connection.js';

// Store ICE candidate queues per peer connection
const iceCandidateQueues = new WeakMap();

// Store pending ICE candidates per peerId (for incoming calls before acceptance)
const pendingIceCandidates = new Map();

// Handle incoming call (receiver)
export async function handleOffer(peerId, offer, localStream, ws, peerConnectionRef, callbacks) {
  const { onStatusChange, onIncomingCall } = callbacks;
  
  onStatusChange(`Incoming call from ${peerId}`);
  console.log('Received offer from:', peerId);

  // Notify component about incoming call - component will handle accept/decline
  onIncomingCall(peerId, async (accept) => {
    if (!accept) {
      // Notify caller that the call was declined
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'call-declined', target: peerId }));
      }
      // Clean up any pending ICE candidates for this peer
      pendingIceCandidates.delete(peerId);
      onStatusChange('Call declined');
      return;
    }

    // Close any existing connection first
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.error('Error closing existing connection:', err);
      }
      peerConnectionRef.current = null;
    }

    // User accepted → create connection
    const peerConnection = createPeerConnection(peerId, localStream, ws, callbacks);
    peerConnectionRef.current = peerConnection;
    
    // Initialize ICE candidate queue for this connection
    const iceCandidateQueue = [];
    iceCandidateQueues.set(peerConnection, iceCandidateQueue);

    try {
      // Set the offer as remote description first
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Set remote description (offer)');

      // Process any pending ICE candidates that arrived before call was accepted
      const pendingCandidates = pendingIceCandidates.get(peerId) || [];
      console.log(`Processing ${pendingCandidates.length} pending ICE candidates for ${peerId}`);
      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added pending ICE candidate');
        } catch (err) {
          console.error('Error adding pending ICE candidate:', err);
        }
      }
      pendingIceCandidates.delete(peerId); // Clear pending candidates for this peer

      // Process any queued ICE candidates that arrived after remote description was set but before processing
      for (const candidate of iceCandidateQueue) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added queued ICE candidate');
        } catch (err) {
          console.error('Error adding queued ICE candidate:', err);
        }
      }
      iceCandidateQueue.length = 0; // Clear the queue

      // Create and set local answer (automatically matches the offer)
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('Created and set local answer');

      // Send the answer back to caller
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'answer', target: peerId, data: answer }));
        onStatusChange('Call accepted, connecting...');
      } else {
        console.error('WebSocket not ready when sending answer');
        onStatusChange('Connection error - WebSocket not ready');
        peerConnection.close();
        peerConnectionRef.current = null;
      }
    } catch (err) {
      console.error('Error handling offer:', err);
      onStatusChange('Error accepting call');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
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
export async function handleIceCandidate(candidate, peerConnection, peerId = null) {
  if (!peerConnection) {
    // If no peer connection but we have a peerId, store candidate for later (incoming call not accepted yet)
    if (peerId && candidate) {
      if (!pendingIceCandidates.has(peerId)) {
        pendingIceCandidates.set(peerId, []);
      }
      pendingIceCandidates.get(peerId).push(candidate);
      console.log(`Stored pending ICE candidate for ${peerId}, total pending:`, pendingIceCandidates.get(peerId).length);
    } else {
      console.log('No peer connection for ICE candidate, ignoring');
    }
    return;
  }
  
  try {
    if (candidate) {
      // Check if remote description is set (required before adding ICE candidates)
      if (!peerConnection.remoteDescription) {
        // Queue the candidate if remote description isn't set yet
        const queue = iceCandidateQueues.get(peerConnection);
        if (queue) {
          queue.push(candidate);
          console.log('Queued ICE candidate (remote description not set yet), queue length:', queue.length);
        } else {
          console.warn('No queue found for peer connection, creating one');
          const newQueue = [candidate];
          iceCandidateQueues.set(peerConnection, newQueue);
        }
        return;
      }
      
      // Remote description is set, add candidate immediately
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Added ICE candidate');
    } else {
      // null candidate means ICE gathering is complete
      console.log('ICE gathering complete');
    }
  } catch (err) {
    // If error is about remote description not set, queue it
    if (err.message && err.message.includes('remote description')) {
      const queue = iceCandidateQueues.get(peerConnection);
      if (queue) {
        queue.push(candidate);
        console.log('Queued ICE candidate after error, queue length:', queue.length);
      } else {
        const newQueue = [candidate];
        iceCandidateQueues.set(peerConnection, newQueue);
      }
    } else {
      console.error('Error adding ICE candidate:', err);
    }
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
  
  // Initialize ICE candidate queue for this connection
  const iceCandidateQueue = [];
  iceCandidateQueues.set(peerConnection, iceCandidateQueue);

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send the offer to the peer
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'offer', target: peerId, data: offer }));
    } else {
      console.error('WebSocket not ready');
      onStatusChange('Connection error - WebSocket not ready');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    }
  } catch (err) {
    console.error('Error making call:', err);
    onStatusChange('Error making call');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }
}
