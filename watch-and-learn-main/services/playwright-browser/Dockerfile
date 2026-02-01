# Browser container with Xvfb, Chromium, VNC, websockify, FFmpeg, and Playwright MCP
FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Display and VNC
    xvfb \
    x11vnc \
    # Chromium and dependencies
    chromium \
    chromium-sandbox \
    fonts-liberation \
    fonts-noto-color-emoji \
    # FFmpeg for video capture
    ffmpeg \
    # Python for video server
    python3 \
    python3-pip \
    python3-venv \
    # Network utilities
    netcat-openbsd \
    # websockify dependencies
    python3-numpy \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Install websockify
RUN pip3 install --break-system-packages websockify

# Install Python dependencies for video server
RUN pip3 install --break-system-packages websockets aiohttp

# Install Playwright and MCP server
RUN npm install -g @playwright/mcp playwright

# Skip browser download since we use system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Create app user for security
RUN useradd -m -s /bin/bash app

# Create necessary directories
RUN mkdir -p /home/app/.vnc /tmp/.X11-unix

# Set display environment
ENV DISPLAY=:99
ENV CHROMIUM_FLAGS="--disable-gpu --disable-software-rasterizer --disable-dev-shm-usage"

# Copy application files
COPY --chown=app:app entrypoint.sh /home/app/entrypoint.sh
COPY --chown=app:app video_server.py /home/app/video_server.py

RUN chmod +x /home/app/entrypoint.sh

# Switch to app user
USER app
WORKDIR /home/app

# Expose ports
# 5900: VNC (internal, not exposed externally)
# 6080: websockify (noVNC WebSocket bridge)
# 8765: MJPEG video stream WebSocket
# 8766: HTTP frame query API
# 3001: MCP server (SSE transport)
EXPOSE 6080 8765 8766 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD nc -z localhost 6080 && nc -z localhost 8765 || exit 1

ENTRYPOINT ["/home/app/entrypoint.sh"]
