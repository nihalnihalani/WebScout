# Watch and Learn

A Docker Compose application that lets you watch and interact with a browser controlled by an AI agent. Features hybrid control where you can both chat with the agent and directly interact with the browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │   noVNC Viewer       │  │      Chat Interface             │  │
│  │   (Browser View)     │  │   (Agent Communication)         │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              │                          │
              ▼                          ▼
┌─────────────────────────┐  ┌─────────────────────────────────────┐
│  playwright-browser     │  │         nextjs-webapp               │
│  - Xvfb + x11vnc        │  │  - Next.js 14                       │
│  - noVNC                │  │  - noVNC embed                      │
│  - Chromium             │  │  - Chat UI                          │
│  - Playwright MCP       │  │                                     │
└─────────────────────────┘  └─────────────────────────────────────┘
              │                          │
              └──────────────────────────┘
                            │
              ┌─────────────────────────────────┐
              │        python-agent             │
              │  - FastAPI WebSocket            │
              │  - Gemini 3 Pro                 │
              │  - MCP Client                   │
              └─────────────────────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Google Gemini API key

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd watch-and-learn
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Build and start the services**
   ```bash
   docker-compose up --build
   ```

4. **Open the application**
   - Navigate to http://localhost:3000
   - You'll see the browser view on the left and chat on the right

## Services

| Service | Port | Description |
|---------|------|-------------|
| nextjs-webapp | 3000 | Main web interface |
| playwright-browser | 6080 | noVNC web interface (direct access) |
| python-agent | 8000 | WebSocket API for agent |

## Usage

### Chat with the Agent
Type commands in the chat window to control the browser:
- "Go to google.com"
- "Search for weather in New York"
- "Click on the first link"
- "What's on the screen?"

### Direct Browser Interaction
Click and type directly in the browser view panel. The AI agent can observe and respond to your actions.

## Development

### Running services individually

**Playwright Browser:**
```bash
cd services/playwright-browser
docker build -t playwright-browser .
docker run -p 6080:6080 -p 3001:3001 playwright-browser
```

**Next.js Webapp:**
```bash
cd services/nextjs-webapp
npm install
npm run dev
```

**Python Agent:**
```bash
cd services/python-agent
pip install -r requirements.txt
GEMINI_API_KEY=your_key python main.py
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| GEMINI_API_KEY | Google Gemini API key | Yes |

## License

MIT
