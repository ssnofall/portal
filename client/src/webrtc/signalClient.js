import { handleOffer, handleAnswer, handleIceCandidate } from './calls.js';

export function setupWebSocket(myId, SIGNALING_URL, localStream, peerConnectionRef, callbacks) {
  const { onStatusChange, onCallDeclined } = callbacks;
  
  const ws = new WebSocket(SIGNALING_URL);

  ws.onopen = () => {
    onStatusChange('Connected to signaling server');
    ws.send(JSON.stringify({ type: 'register', clientId: myId }));
  };

  ws.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    switch (data.type) {
      case 'offer':
        await handleOffer(data.from, data.data, localStream, ws, peerConnectionRef, callbacks);
        break;
      case 'answer':
        await handleAnswer(data.data, peerConnectionRef.current, callbacks);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data.data, peerConnectionRef.current);
        break;
      case 'call-declined':
        onCallDeclined(data.from);
        onStatusChange('Call declined by peer');
        break;
      case 'register-success':
        console.log('Registered with server, ID:', data.clientId);
        break;
      case 'register-failed':
        console.error('Registration failed:', data.reason);
        onStatusChange('Registration failed');
        break;
    }
  };

  ws.onerror = () => onStatusChange('WebSocket error');
  ws.onclose = () => onStatusChange('Disconnected from server');

  return ws;
}
