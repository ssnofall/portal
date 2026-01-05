import { handleOffer, handleAnswer, handleIceCandidate } from './calls.js';

// Get localStream from the global scope or DOM
function getLocalStream() {
  // Try to get from video element
  const localVideo = document.getElementById('localVideo');
  if (localVideo && localVideo.srcObject) {
    return localVideo.srcObject;
  }
  return null;
}

export function setupWebSocket(myId, SIGNALING_URL, initialLocalStream, setStatus) {
  const ws = new WebSocket(SIGNALING_URL);

  ws.onopen = () => {
    setStatus('Connected to signaling server');
    ws.send(JSON.stringify({ type: 'register', clientId: myId }));
  };

  ws.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    switch (data.type) {
      case 'offer':
        // Get current localStream (might have been updated)
        const localStream = getLocalStream() || initialLocalStream;
        await handleOffer(data.from, data.data, localStream, ws, setStatus);
        break;
      case 'answer':
        await handleAnswer(data.data, setStatus);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data.data);
        break;
      case 'call-declined':
        alert(`Your call to ${data.from} was declined`);
        setStatus('Call declined by peer');
        break;
      case 'register-success':
        console.log('Registered with server, ID:', data.clientId);
        break;
      case 'register-failed':
        console.error('Registration failed:', data.reason);
        setStatus('Registration failed');
        break;
    }
  };

  ws.onerror = () => setStatus('WebSocket error');
  ws.onclose = () => setStatus('Disconnected from server');

  return ws;
}
