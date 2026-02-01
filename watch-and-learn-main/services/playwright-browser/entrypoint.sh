#!/bin/bash
set -e

# Configuration
DISPLAY_NUM=99
SCREEN_WIDTH=${SCREEN_WIDTH:-1920}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-1080}
SCREEN_DEPTH=${SCREEN_DEPTH:-24}
VNC_PORT=5900
WEBSOCKIFY_PORT=6080
VIDEO_WS_PORT=8765

echo "Starting browser container services..."

# Clean up stale X11 lock files from previous runs
rm -f /tmp/.X${DISPLAY_NUM}-lock /tmp/.X11-unix/X${DISPLAY_NUM} 2>/dev/null || true

# Cleanup function
cleanup() {
    echo "Shutting down services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Clean up any stale X lock files
echo "Cleaning up stale X lock files..."
rm -f /tmp/.X${DISPLAY_NUM}-lock
rm -f /tmp/.X11-unix/X${DISPLAY_NUM}

# Start Xvfb (virtual framebuffer)
echo "Starting Xvfb on display :${DISPLAY_NUM}..."
Xvfb :${DISPLAY_NUM} -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} &
XVFB_PID=$!

# Wait for Xvfb to be ready
sleep 2
if ! kill -0 $XVFB_PID 2>/dev/null; then
    echo "ERROR: Xvfb failed to start"
    exit 1
fi
echo "Xvfb started successfully"

# Start x11vnc (VNC server)
echo "Starting x11vnc on port ${VNC_PORT}..."
x11vnc -display :${DISPLAY_NUM} \
    -forever \
    -shared \
    -rfbport ${VNC_PORT} \
    -nopw \
    -xkb \
    -noxrecord \
    -noxfixes \
    -noxdamage \
    -wait 5 \
    -defer 5 \
    &
X11VNC_PID=$!

# Wait for x11vnc to be ready
sleep 2
if ! kill -0 $X11VNC_PID 2>/dev/null; then
    echo "ERROR: x11vnc failed to start"
    exit 1
fi
echo "x11vnc started successfully"

# Start websockify (WebSocket to VNC bridge)
echo "Starting websockify on port ${WEBSOCKIFY_PORT}..."
websockify ${WEBSOCKIFY_PORT} localhost:${VNC_PORT} &
WEBSOCKIFY_PID=$!

# Wait for websockify to be ready
sleep 1
if ! kill -0 $WEBSOCKIFY_PID 2>/dev/null; then
    echo "ERROR: websockify failed to start"
    exit 1
fi
echo "websockify started successfully"

# Start video streaming server
echo "Starting video streaming server on port ${VIDEO_WS_PORT}..."
python3 /home/app/video_server.py &
VIDEO_SERVER_PID=$!

# Wait for video server to be ready
sleep 2
if ! kill -0 $VIDEO_SERVER_PID 2>/dev/null; then
    echo "ERROR: Video streaming server failed to start"
    exit 1
fi
echo "Video streaming server started successfully"

# Start Chromium browser with remote debugging
CDP_PORT=9222
echo "Starting Chromium browser with remote debugging on port ${CDP_PORT}..."
chromium \
    --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    --window-size=${SCREEN_WIDTH},${SCREEN_HEIGHT} \
    --window-position=0,0 \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-features=PushMessaging,GCMForWebPush \
    --disable-notifications \
    --disable-sync \
    --disable-background-networking \
    --no-first-run \
    --no-sandbox \
    --disable-setuid-sandbox \
    --remote-debugging-port=${CDP_PORT} \
    --remote-debugging-address=0.0.0.0 \
    "https://www.google.com" &
CHROMIUM_PID=$!

# Wait for Chromium to be ready
sleep 3
if ! kill -0 $CHROMIUM_PID 2>/dev/null; then
    echo "ERROR: Chromium failed to start"
    exit 1
fi
echo "Chromium started successfully"

# Start Playwright MCP server (SSE transport) connected to existing browser
MCP_PORT=${MCP_PORT:-3001}
echo "Starting Playwright MCP server on port ${MCP_PORT}..."
npx @playwright/mcp \
    --cdp-endpoint http://localhost:${CDP_PORT} \
    --port ${MCP_PORT} \
    --host 0.0.0.0 \
    --allowed-hosts '*' &
MCP_PID=$!

# Wait for MCP server to be ready
sleep 3
if ! kill -0 $MCP_PID 2>/dev/null; then
    echo "ERROR: Playwright MCP server failed to start"
    exit 1
fi
echo "Playwright MCP server started successfully"

echo ""
echo "=========================================="
echo "Browser container services started:"
echo "  - Xvfb display: :${DISPLAY_NUM}"
echo "  - VNC: localhost:${VNC_PORT}"
echo "  - WebSocket (noVNC): ws://localhost:${WEBSOCKIFY_PORT}"
echo "  - Video Stream: ws://localhost:${VIDEO_WS_PORT}"
echo "  - MCP Server (SSE): http://localhost:${MCP_PORT}"
echo "=========================================="
echo ""

# Wait for any process to exit
wait -n

# If we get here, a process has exited
echo "A service has exited, shutting down..."
cleanup
