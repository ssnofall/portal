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
// Default to HTTPS enabled, can be disabled with USE_SSL=false
const USE_SSL = process.env.USE_SSL !== 'false';

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

// Serve configuration (needed for React app)
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
    window.APP_CONFIG = {
      SIGNALING_URL: '${SIGNALING_URL}'
    };
  `);
});

// Serve built React app in production, or fallback to public for development
const buildPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(buildPath)) {
  // Serve built React app static files
  app.use(express.static(buildPath));
  // Handle React Router - serve index.html for all non-API routes
  // This must come after static files but will only match if static files don't
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path === '/config.js' || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
  console.log('Serving built React app from client/dist');
} else {
  // Fallback: serve from public directory (for development or legacy)
  app.use(express.static('public'));
  console.log('Serving static files from public (development mode)');
  console.log('Note: For React development, run "npm run dev" in the client directory');
}

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
    console.error('ERROR: SSL certificates not found!');
    console.error(`Expected files:`);
    console.error(`  - ${keyPath}`);
    console.error(`  - ${certPath}`);
    console.error('\nTo generate certificates, run:');
    console.error('  cd certs');
    console.error('  openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365');
    console.error('\nOr set USE_SSL=false in your .env file to run without SSL (not recommended).');
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