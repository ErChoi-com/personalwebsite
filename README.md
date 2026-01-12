# Ernest Choi Portfolio

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![GitHub](https://img.shields.io/badge/GitHub-ErChoi--com-181717?logo=github)](https://github.com/ErChoi-com)
[![Portfolio](https://img.shields.io/badge/Portfolio-Live-brightgreen)](https://erchoi-com.github.io/terminalcards)

A portfolio website featuring peer-to-peer gaming systems and procedural terrain generation built with modern web technologies.

## Live Demo

Visit the live portfolio: [ernestchoi.com](ernestchoi.com)

## Table of Contents

- [Terminal Cards](#terminal-cards)
- [Terrain Generator](#terrain-generator)
- [Technologies Used](#technologies-used)
- [Installation & Setup](#installation--setup)
- [Development](#development)
- [License](#license)
- [Contact](#contact)

## Terminal Cards

A **peer-to-peer card gaming platform** with a terminal-style interface. Players connect directly without centralized servers using WebRTC technology.

**Key Features:**
- Peer-to-peer networking using PeerJS
- Terminal-style command interface
- Secure key generation for sessions
- Real-time multiplayer gaming
- Cross-platform browser support

**Available Commands:**
- `keygen` - Generate connection key
- `connect <key>` - Join another player's session
- `help` - Show available commands

## Terrain Generator

A **procedural terrain generation system** that creates 3D landscapes using mathematical algorithms and noise functions.

**Features:**
- Multiple noise algorithms (Perlin noise, wave functions)
- Real-time parameter adjustment
- WebGL-powered 3D visualization
- Multiple language implementations (JavaScript, Python, C++)

**Recommended Parameters:**
- Octaves: `1`
- Frequency: `140`
- Amplitude: `3`

## Technologies Used

**Core:** HTML5, CSS3, JavaScript (ES6+), Node.js

**Libraries:** PeerJS (WebRTC), GSAP (animations), Express.js, Vite

**Tools:** Git, npm, ESLint, Prettier

## Installation & Setup

**Prerequisites:** Node.js (16+), npm, modern web browser

```bash
# Clone and setup
git clone https://github.com/ErChoi-com/terminalcards.git
cd terminalcards
npm install
npm run dev
```

Visit http://localhost:3000 to view the portfolio.

## Development

**Project Structure:**
```
├── index.html              # Main portfolio page
├── terminalcards/          # Terminal Cards game
├── terrain/                # Terrain Generator
│   ├── src/               # Generator interface
│   └── textures/          # Noise implementations
├── images/                 # Static assets
└── styles.css              # Global styles
```

**Scripts:**
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Preview build

## License

ISC License - see [LICENSE](LICENSE) file for details.

## Contact

**Ernest Choi**
- Portfolio: [www.ernestchoi.com](www.ernestchoi.com)
- GitHub: [@ErChoi-com](https://github.com/ErChoi-com)
- Resume: [View on Overleaf](https://www.overleaf.com/read/njwfnpbccdzq#ce6706)