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
          clientId = data.clientId;
          clients.set(clientId, ws);
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
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  const protocol = USE_SSL ? 'wss' : 'ws';
  console.log(`
Signaling server running!
Protocol: ${protocol}
Port: ${PORT}
  `);
});