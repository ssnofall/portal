
// Generate a unique random ID for this user
const myId = 'peer_' + Math.random().toString(36).substring(2, 11);
document.getElementById('myId').textContent = myId;

// Get signaling server URL from config
const SIGNALING_URL = window.APP_CONFIG?.SIGNALING_URL || 'ws://localhost:3001';
console.log('Connecting to:', SIGNALING_URL);

// Connect to signaling server via WebSocket
const ws = new WebSocket(SIGNALING_URL);

// WebRTC configuration
// STUN servers help find your public IP address
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Global variables
let peerConnection = null;  // The WebRTC connection
let localStream = null;      // Your camera/mic stream

// UTILITY FUNCTIONS

// Update status message on screen
function setStatus(message) {
  document.getElementById('status').textContent = message;
  console.log('Status:', message);
}
// WEBSOCKET EVENT HANDLERS

// When connected to signaling server
ws.onopen = () => {
  setStatus('Connected to signaling server');
  
  // Register ourselves with the server
  ws.send(JSON.stringify({
    type: 'register',
    clientId: myId
  }));
  
  // Start camera after WebSocket is connected
  if (!localStream) {
    startLocalStream();
  }
};

// Handle connection errors
ws.onerror = (error) => {
  setStatus('Error connecting to signaling server');
  console.error('WebSocket error:', error);
};

// Handle disconnection
ws.onclose = () => {
  setStatus('Disconnected from signaling server');
};

// Handle incoming messages from signaling server
ws.onmessage = async (message) => {
  try {
    const data = JSON.parse(message.data);
    console.log('Received:', data.type, 'from:', data.from);
    
    // Route to appropriate handler based on message type
    switch(data.type) {
      case 'offer':
        await handleOffer(data.from, data.data);
        break;
      case 'answer':
        await handleAnswer(data.data);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data.data);
        break;
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
};

// MEDIA STREAM FUNCTIONS

// Get user's camera and microphone
async function startLocalStream() {
  try {
    setStatus('Requesting camera and microphone access...');
    
    // Request access to camera and microphone
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: {
        echoCancellation: true,  // Reduce echo
        noiseSuppression: true   // Reduce background noise
      }
    });
    
    // Display local video
    document.getElementById('localVideo').srcObject = localStream;
    setStatus('Camera and microphone active');
    return true;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    setStatus('Could not access camera/microphone');
    alert('Please allow camera and microphone access to use this app');
    return false;
  }
}
// WEBRTC CONNECTION FUNCTIONS

// Create a new peer-to-peer connection
function createPeerConnection(peerId) {
  // Create the RTCPeerConnection
  peerConnection = new RTCPeerConnection(configuration);
  
  // Add our local video/audio tracks to the connection
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
      console.log('Added local track:', track.kind);
    });
  }
  
  // Handle when we receive remote video/audio
  peerConnection.ontrack = (event) => {
    console.log('Received remote track:', event.track.kind);
    setStatus('✓ Connected! Video call active');
    
    // Display remote video
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = event.streams[0];
  };
  
  // Handle ICE candidates (network connection info)
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && ws.readyState === WebSocket.OPEN) {
      console.log('Sending ICE candidate');
      
      // Send candidate to peer via signaling server
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        target: peerId,
        data: event.candidate
      }));
    } else if (!event.candidate) {
      console.log('ICE gathering complete');
    }
  };
  
  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    
    switch(peerConnection.connectionState) {
      case 'connected':
        setStatus('Connected! Video call active');
        break;
      case 'disconnected':
        setStatus('Connection lost');
        break;
      case 'failed':
        setStatus('Connection failed');
        break;
      case 'closed':
        setStatus('Call ended');
        break;
    }
  };
  
  // Log ICE gathering state
  peerConnection.onicegatheringstatechange = () => {
    console.log('ICE gathering state:', peerConnection.iceGatheringState);
  };
  
  return peerConnection;
}
// CALL INITIATION & HANDLING

// Start a call (you're the caller)
async function makeCall(peerId) {
  setStatus('Calling...');
  console.log('Making call to:', peerId);
  
  // Close existing connection if any
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Create peer connection
  createPeerConnection(peerId);
  
  try {
    // Create an offer (call proposal)
    const offer = await peerConnection.createOffer();
    
    // Set it as our local description
    await peerConnection.setLocalDescription(offer);
    
    console.log('Created offer, sending to peer');
    
    // Send offer to the other peer via signaling server
    ws.send(JSON.stringify({
      type: 'offer',
      target: peerId,
      data: offer
    }));
  } catch (error) {
    console.error('Error making call:', error);
    setStatus('Error making call');
  }
}

// Handle incoming call (you're the receiver)
async function handleOffer(peerId, offer) {
  setStatus('Incoming call from ' + peerId);
  console.log('Received offer from:', peerId);
  
  // Close existing connection if any
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Create peer connection
  createPeerConnection(peerId);
  
  try {
    // Set the offer as remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create an answer
    const answer = await peerConnection.createAnswer();
    
    // Set it as our local description
    await peerConnection.setLocalDescription(answer);
    
    console.log('Created answer, sending to peer');
    
    // Send answer back via signaling server
    ws.send(JSON.stringify({
      type: 'answer',
      target: peerId,
      data: answer
    }));
    
    setStatus('Answered call, connecting...');
  } catch (error) {
    console.error('Error handling offer:', error);
    setStatus('Error accepting call');
  }
}

// Handle answer to our call
async function handleAnswer(answer) {
  console.log('Received answer');
  
  try {
    // Set the answer as remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    setStatus('✓ Call accepted, connecting...');
  } catch (error) {
    console.error('Error handling answer:', error);
  }
}

// Handle ICE candidates (network paths)
async function handleIceCandidate(candidate) {
  console.log('Received ICE candidate');
  
  if (!peerConnection) {
    console.warn('Received ICE candidate but no peer connection exists');
    return;
  }
  
  try {
    if (candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
  }
}
// UI EVENT HANDLERS

// Handle call button click
document.getElementById('callBtn').addEventListener('click', async () => {
  const peerId = document.getElementById('peerId').value.trim();
  
  // Validate peer ID
  if (!peerId) {
    alert('Please enter a peer ID');
    return;
  }
  
  if (peerId === myId) {
    alert('You cannot call yourself!');
    return;
  }
  
  // Make sure WebSocket is connected
  if (ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to signaling server. Please wait...');
    return;
  }
  
  // Make sure we have camera access
  if (!localStream) {
    const success = await startLocalStream();
    if (!success) return;
  }
  
  // Initiate the call
  makeCall(peerId);
});

// INITIALIZATION

// Wait for WebSocket to connect before starting camera
// Camera will start automatically when WebSocket connects (see ws.onopen)

console.log('Client initialized. Your ID:', myId);
