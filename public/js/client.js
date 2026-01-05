import { generatePeerId } from './utils.js';
import { setupWebSocket } from './signalClient.js';
import { makeCall } from './calls.js';

const SIGNALING_URL = window.APP_CONFIG?.SIGNALING_URL || 'ws://localhost:3001';
const myId = generatePeerId();
document.getElementById('myId').textContent = myId;

let localStream = null;

function setStatus(message) {
  document.getElementById('status').textContent = message;
  console.log('Status:', message);
}

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    document.getElementById('localVideo').srcObject = localStream;
    setStatus('Camera and microphone active');
    return true;
  } catch (err) {
    console.error(err);
    alert('Please allow camera and microphone access');
    setStatus('Could not access camera/microphone');
    return false;
  }
}

// Initialize WebSocket
const ws = setupWebSocket(myId, SIGNALING_URL, localStream, setStatus);

// Call button
document.getElementById('callBtn').addEventListener('click', async () => {
  const peerId = document.getElementById('peerId').value.trim();
  if (!peerId) return alert('Enter a peer ID');
  if (peerId === myId) return alert('Cannot call yourself');

  if (!localStream) {
    const ok = await startLocalStream();
    if (!ok) return;
  }

  makeCall(peerId, localStream, ws, setStatus);
});

console.log('Client initialized. Your ID:', myId);
startLocalStream();
