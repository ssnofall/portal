require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.WEB_PORT || 3000;
const SIGNALING_PORT = process.env.SIGNALING_PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const USE_SSL = process.env.USE_SSL === 'true';

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Apply rate limiting to all requests
app.use(limiter);

// Determine protocol for WebSocket
const WS_PROTOCOL = USE_SSL ? 'wss' : 'ws';
const HTTP_PROTOCOL = USE_SSL ? 'https' : 'http';
const SIGNALING_URL = `${WS_PROTOCOL}://${HOST}:${SIGNALING_PORT}`;

// Serve static files
app.use(express.static('public'));

// Serve configuration
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    window.APP_CONFIG = {
      SIGNALING_URL: '${SIGNALING_URL}'
    };
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    ssl: USE_SSL,
    signaling: SIGNALING_URL 
  });
});

// Create server (HTTP or HTTPS based on config)
let server;

if (USE_SSL) {
  // Read SSL certificate files
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
  
  server = https.createServer(options, app);
  console.log('HTTPS enabled');
} else {
  server = http.createServer(app);
  console.log('Running without SSL (HTTP only)');
}

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
Web server running!
Protocol: ${HTTP_PROTOCOL}
URL: ${HTTP_PROTOCOL}://${HOST}:${PORT}
Signaling: ${SIGNALING_URL}
  `);
});