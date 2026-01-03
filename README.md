# Portal

**Portal is a peer-to-peer video chat web application built with WebRTC and JavaScript.**

[![JavaScript](https://img.shields.io/badge/logo-javascript-yellow?logo=javascript)
[![Project Status](https://img.shields.io/badge/status-in_progress-yellow)](https://github.com/ssnofall/portal)
[![Node.js](https://img.shields.io/badge/Node.js-required-green?logo=node.js)](https://nodejs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

<img src="img.png" alt="Portal Preview" width="800"/>


Portal enables direct audio and video communication between browsers using WebRTC, with a lightweight signaling server to facilitate peer discovery.

This project is currently **in progress** and will continue to evolve based on feedback and new feature requests.

## Project Goals

The primary goal of this project is to learn and demonstrate how to build a peer-to-peer web application using JavaScript and WebRTC.

## Features

- Real-time audio and video calling via WebRTC
- Unique peer identification (like a "phone number" for direct connections)
- Secure signaling server over WebSockets
- Self-signed SSL certificates for local HTTPS deployment (required by modern browsers for WebRTC)

## Tech Stack

- **Frontend**: Plain HTML, CSS, and JavaScript (served from the `public` directory)
- **Backend**: Node.js server to serve the app over HTTPS
- **Signaling**: Secure WebSocket server for peer matchmaking

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/ssnofall/portal.git
cd portal
```
2. Install Dependecies
```bash
npm install
```
3. Create the required directories and files:
```bash
mkdir certs
touch .env
```
4. Configure your '.env' file. Replace the 'HOST' value with your machine's local IP address:
```bash
NODE_ENV=development
WEB_PORT=3000
SIGNALING_PORT=3001
HOST=192.168.1.100
USE_SSL=true
```
5. Generate a self-signed certificate:
```bash
cd certs
openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365
```
- You can press Enter for most prompts to accept the defaults.
- For Common Name, enter your IP address (e.g., 192.168.1.100).

### Running the App
```bash
cd ..  # If you're still in the certs folder
npm run dev:all
```

---

## Contributing
- Contributions, bug reports, and feature requests are welcome!

- Feel free to open an issue or submit a pull request.

---

## License

This project is licensed under the GNU General Public License v3.0
