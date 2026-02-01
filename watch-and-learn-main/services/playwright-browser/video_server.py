#!/usr/bin/env python3
"""
MJPEG Video Streaming Server

Captures X11 display using FFmpeg and broadcasts MJPEG frames
over WebSocket to connected clients. Also maintains a rolling buffer
of recent frames for historical frame queries.
"""

import asyncio
import contextlib
import logging
import os
import signal
import sys
import time
from collections import deque
from typing import Tuple

import websockets
from aiohttp import web
from websockets.asyncio.server import Server, ServerConnection, serve

# Configuration
DISPLAY = os.environ.get("DISPLAY", ":99")
VIDEO_WS_PORT = int(os.environ.get("VIDEO_WS_PORT", "8765"))
VIDEO_HTTP_PORT = int(os.environ.get("VIDEO_HTTP_PORT", "8766"))
FRAME_RATE = int(os.environ.get("VIDEO_FRAME_RATE", "15"))
JPEG_QUALITY = int(os.environ.get("JPEG_QUALITY", "80"))
SCREEN_WIDTH = int(os.environ.get("SCREEN_WIDTH", "1920"))
SCREEN_HEIGHT = int(os.environ.get("SCREEN_HEIGHT", "1080"))
BUFFER_DURATION_MS = int(os.environ.get("BUFFER_DURATION_MS", "500"))

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("video_server")


class VideoStreamingServer:
    """WebSocket server that broadcasts MJPEG video stream with frame buffering."""

    def __init__(self) -> None:
        self.clients: set[ServerConnection] = set()
        self.ffmpeg_process: asyncio.subprocess.Process | None = None
        self.running = False
        self.server: Server | None = None
        self.http_app: web.Application | None = None
        self.http_runner: web.AppRunner | None = None
        # Frame buffer: stores (timestamp_ms, frame_bytes) tuples
        self.frame_buffer: deque[Tuple[float, bytes]] = deque()
        self.buffer_lock = asyncio.Lock()

    async def start_ffmpeg(self) -> asyncio.subprocess.Process:
        """Start FFmpeg process to capture X11 and output MJPEG frames."""
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            # Input: X11 display capture
            "-f",
            "x11grab",
            "-framerate",
            str(FRAME_RATE),
            "-video_size",
            f"{SCREEN_WIDTH}x{SCREEN_HEIGHT}",
            "-i",
            DISPLAY,
            # Output encoding - MJPEG
            "-c:v",
            "mjpeg",
            "-q:v",
            str(max(2, min(31, 32 - int(JPEG_QUALITY * 0.31)))),
            "-f",
            "image2pipe",
            "-vcodec",
            "mjpeg",
            # Output to stdout
            "pipe:1",
        ]

        logger.info(f"Starting FFmpeg: {' '.join(cmd)}")

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        return process

    async def log_ffmpeg_stderr(self) -> None:
        """Log FFmpeg stderr output."""
        if not self.ffmpeg_process or not self.ffmpeg_process.stderr:
            return

        while self.running:
            try:
                line = await self.ffmpeg_process.stderr.readline()
                if not line:
                    break
                logger.warning(f"FFmpeg: {line.decode().strip()}")
            except Exception as e:
                logger.error(f"Error reading FFmpeg stderr: {e}")
                break

    async def add_frame_to_buffer(self, frame: bytes) -> None:
        """Add a frame to the buffer with timestamp and clean up old frames."""
        current_time_ms = time.time() * 1000

        async with self.buffer_lock:
            # Add new frame
            self.frame_buffer.append((current_time_ms, frame))

            # Remove frames older than BUFFER_DURATION_MS
            cutoff_time = current_time_ms - BUFFER_DURATION_MS
            while self.frame_buffer and self.frame_buffer[0][0] < cutoff_time:
                self.frame_buffer.popleft()

    async def get_historical_frame(self, offset_ms: int) -> bytes | None:
        """Get a frame from offset_ms milliseconds ago.

        Args:
            offset_ms: How many milliseconds in the past to look for a frame

        Returns:
            Frame bytes if found, None otherwise
        """
        target_time = (time.time() * 1000) - offset_ms

        async with self.buffer_lock:
            if not self.frame_buffer:
                return None

            # Find the frame closest to target_time (but not newer)
            closest_frame = None
            min_diff = float('inf')

            for timestamp, frame in self.frame_buffer:
                if timestamp <= target_time:
                    diff = target_time - timestamp
                    if diff < min_diff:
                        min_diff = diff
                        closest_frame = frame

            return closest_frame

    async def broadcast(self, data: bytes) -> None:
        """Send data to all connected clients."""
        if not self.clients:
            return

        disconnected = set()
        for client in list(self.clients):
            try:
                await client.send(data)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.warning(f"Error sending to client: {e}")
                disconnected.add(client)

        self.clients -= disconnected
        if disconnected:
            logger.info(f"Removed {len(disconnected)} disconnected clients")

    async def handle_client(self, websocket: ServerConnection) -> None:
        """Handle a new WebSocket client connection."""
        client_addr = websocket.remote_address
        logger.info(f"Client connected: {client_addr}")
        self.clients.add(websocket)

        try:
            async for message in websocket:
                logger.debug(f"Received from {client_addr}: {message}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            logger.info(f"Client disconnected: {client_addr}")

    async def stream_video(self) -> None:
        """Read JPEG frames from FFmpeg and broadcast to clients."""
        if not self.ffmpeg_process or not self.ffmpeg_process.stdout:
            logger.error("FFmpeg process not available")
            return

        logger.info("Starting MJPEG video stream...")
        total_frames = 0
        buffer = bytearray()

        # JPEG markers
        SOI = b"\xff\xd8"  # Start of Image
        EOI = b"\xff\xd9"  # End of Image

        while self.running:
            try:
                # Read chunk from FFmpeg
                chunk = await self.ffmpeg_process.stdout.read(65536)

                if not chunk:
                    returncode = await self.ffmpeg_process.wait()
                    logger.warning(f"FFmpeg exited with code {returncode}")
                    break

                buffer.extend(chunk)

                # Extract complete JPEG frames from buffer
                while True:
                    # Find start of JPEG
                    soi_pos = buffer.find(SOI)
                    if soi_pos == -1:
                        buffer.clear()
                        break

                    # Discard data before SOI
                    if soi_pos > 0:
                        del buffer[:soi_pos]

                    # Find end of JPEG
                    eoi_pos = buffer.find(EOI, 2)
                    if eoi_pos == -1:
                        # Incomplete frame, wait for more data
                        break

                    # Extract complete JPEG frame
                    frame = bytes(buffer[: eoi_pos + 2])
                    del buffer[: eoi_pos + 2]

                    total_frames += 1
                    if total_frames % 30 == 0:
                        logger.debug(
                            f"Streamed {total_frames} frames to {len(self.clients)} clients"
                        )

                    # Add frame to buffer for historical queries
                    await self.add_frame_to_buffer(frame)

                    # Broadcast frame
                    await self.broadcast(frame)

            except asyncio.CancelledError:
                logger.info("Video streaming cancelled")
                break
            except Exception as e:
                logger.error(f"Error in video stream: {e}")
                break

        logger.info(f"Video stream ended, total frames: {total_frames}")

    async def handle_frame_request(self, request: web.Request) -> web.Response:
        """HTTP handler to get a historical frame.

        Query parameters:
            offset_ms: Milliseconds in the past to retrieve frame (default: 100)

        Returns:
            JPEG image with appropriate headers
        """
        try:
            offset_ms = int(request.query.get('offset_ms', '100'))
        except ValueError:
            return web.Response(status=400, text="Invalid offset_ms parameter")

        if offset_ms < 0 or offset_ms > BUFFER_DURATION_MS:
            return web.Response(
                status=400,
                text=f"offset_ms must be between 0 and {BUFFER_DURATION_MS}"
            )

        frame = await self.get_historical_frame(offset_ms)

        if frame is None:
            return web.Response(status=404, text="No frame available in buffer")

        return web.Response(
            body=frame,
            content_type='image/jpeg',
            headers={
                'Cache-Control': 'no-cache',
                'X-Frame-Offset-Ms': str(offset_ms),
            }
        )

    async def handle_health(self, request: web.Request) -> web.Response:
        """HTTP handler for health check endpoint."""
        async with self.buffer_lock:
            buffer_size = len(self.frame_buffer)

        return web.json_response({
            'status': 'healthy',
            'buffer_size': buffer_size,
            'buffer_duration_ms': BUFFER_DURATION_MS,
            'frame_rate': FRAME_RATE,
        })

    async def run(self) -> None:
        """Run the video streaming server."""
        self.running = True

        # Start FFmpeg
        try:
            self.ffmpeg_process = await self.start_ffmpeg()
            logger.info("FFmpeg started successfully")
        except Exception as e:
            logger.error(f"Failed to start FFmpeg: {e}")
            return

        # Start stderr logging task
        stderr_task = asyncio.create_task(self.log_ffmpeg_stderr())

        # Start HTTP server for frame queries
        self.http_app = web.Application()
        self.http_app.router.add_get('/frame', self.handle_frame_request)
        self.http_app.router.add_get('/health', self.handle_health)
        self.http_runner = web.AppRunner(self.http_app)
        await self.http_runner.setup()
        site = web.TCPSite(self.http_runner, '0.0.0.0', VIDEO_HTTP_PORT)
        await site.start()
        logger.info(f"HTTP frame query server listening on http://0.0.0.0:{VIDEO_HTTP_PORT}")

        # Start WebSocket server
        self.server = await serve(
            self.handle_client,
            "0.0.0.0",
            VIDEO_WS_PORT,
            ping_interval=20,
            ping_timeout=60,
        )
        logger.info(f"MJPEG WebSocket server listening on ws://0.0.0.0:{VIDEO_WS_PORT}")

        # Start streaming task
        stream_task = asyncio.create_task(self.stream_video())

        # Wait for streaming to complete
        with contextlib.suppress(asyncio.CancelledError):
            await stream_task

        # Cleanup
        stderr_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await stderr_task

        self.stop()

    def stop(self) -> None:
        """Stop the server and cleanup resources."""
        self.running = False

        if self.ffmpeg_process:
            logger.info("Stopping FFmpeg...")
            with contextlib.suppress(ProcessLookupError):
                self.ffmpeg_process.terminate()

        if self.server:
            self.server.close()

        if self.http_runner:
            asyncio.create_task(self.http_runner.cleanup())

        logger.info("Video server stopped")


async def main() -> None:
    """Main entry point."""
    server = VideoStreamingServer()

    loop = asyncio.get_event_loop()

    def signal_handler() -> None:
        logger.info("Received shutdown signal")
        server.running = False
        server.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)

    await server.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
