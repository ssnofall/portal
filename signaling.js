require('dotenv').config();
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.SIGNALING_PORT || 3001;
const USE_SSL = process.env.USE_SSL === 'true';

let server;
let wss;



if (USE_SSL) {
  // Create HTTPS server for WebSocket
  const keyPath = path.join(__dirname, 'certs', 'server.key');
  const certPath = path.join(__dirname, 'certs', 'server.cert');
  
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error('SSL certificates not found. Please generate certificates in the certs/ directory.');
    console.error('Or set USE_SSL=false in your .env file to run without SSL.');
    process.exit(1);
  }
  
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  server = https.createServer(options);
  wss = new WebSocket.Server({ server });
  console.log('WSS (Secure WebSocket) enabled');
} else {
  // Create regular HTTP server for WebSocket
  server = http.createServer();
  wss = new WebSocket.Server({ server });
  console.log('Using WS (insecure WebSocket)');
}

let clients = new Map();

wss.on('connection', (ws, req) => {
  let clientId = null;
  const ip = req.socket.remoteAddress;
  
  console.log(`New client connected from ${ip}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch(data.type) {
      case 'register':
        // Step 1: Use client-provided ID or generate a secure one
        clientId = data.clientId || generatePeerId();

        // Step 2: Check for duplicate
        if (clients.has(clientId)) {
          console.warn(`Duplicate client ID attempted: ${clientId}`);
          ws.send(JSON.stringify({
            type: 'register-failed',
            reason: 'ID already in use. Please generate a new one.'
          }));
          clientId = null; // prevent storing duplicate
          return;
        }

        // Step 3: Store client
        clients.set(clientId, ws);

        // Step 4: Send success to client
        ws.send(JSON.stringify({
          type: 'register-success',
          clientId
        }));

        console.log(`Client registered: ${clientId} (Total: ${clients.size})`);
        break;

          
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          const targetClient = clients.get(data.target);
          if (targetClient && targetClient.readyState === WebSocket.OPEN) {
            targetClient.send(JSON.stringify({
              type: data.type,
              from: clientId,
              data: data.data
            }));
            console.log(`Relayed ${data.type} from ${clientId} to ${data.target}`);
          } else {
            console.warn(`Target client ${data.target} not found or disconnected`);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  ws.on('close', () => {
  if (clientId) {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (Total: ${clients.size})`);
  }
});
});

// Fallback Generate a random peer ID
function generatePeerId(length = 10) {
  const array = new Uint8Array(length);          // make an array of bytes
  crypto.getRandomValues(array);                 // fill it with random numbers
  return 'peer_' + Array.from(array, byte => byte.toString(36).padStart(2, '0'))
                         .join('')
                         .substring(0, length); // shorten to the length we want
}

// Auto generate new id if duplicate found
function registerWithServer() {
  const myId = generatePeerId(); // secure random ID
  ws.send(JSON.stringify({
    type: 'register',
    clientId: myId
  }));
}


// Start the server
server.listen(PORT, '0.0.0.0', () => {
  const protocol = USE_SSL ? 'wss' : 'ws';
  console.log(`
Signaling server running!
Protocol: ${protocol}
Port: ${PORT}
  `);
});