import asyncio
import glob
import json
import logging
import os

from fastapi import FastAPI, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from agent import BrowserAgent
from mcp_client import MCPClient
from rag_retriever import RAGRetriever
from recording_models import RecordingSession
from recording_storage import RecordingStorage
from voyage_service import VoyageService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Watch and Learn Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections and their agents
active_connections: dict[str, tuple[WebSocket, BrowserAgent]] = {}

# Shared MCP client for all agents

shared_mcp_client: MCPClient | None = None
shared_mcp_lock: asyncio.Lock | None = None

# Global recording agent for manual control mode
recording_agent: BrowserAgent | None = None
recording_agent_lock: asyncio.Lock | None = None

# MongoDB storage, Voyage AI service, and RAG retriever
recording_storage: RecordingStorage | None = None
voyage_service: VoyageService | None = None
rag_retriever: RAGRetriever | None = None


@app.on_event("startup")
async def startup_event():
    global recording_agent_lock, shared_mcp_lock, shared_mcp_client
    global recording_storage, voyage_service, rag_retriever

    recording_agent_lock = asyncio.Lock()
    shared_mcp_lock = asyncio.Lock()

    # Initialize MongoDB storage
    logger.info("Initializing MongoDB storage")
    try:
        recording_storage = RecordingStorage()
        recording_storage.connect()
        logger.info("MongoDB storage initialized successfully")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        # Continue without MongoDB - recording storage will be unavailable

    # Initialize Voyage AI service
    logger.info("Initializing Voyage AI service")
    try:
        voyage_service = VoyageService()
        logger.info("Voyage AI service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Voyage AI: {e}")
        # Continue without Voyage - embedding will be unavailable

    # Initialize RAG retriever if both storage and voyage are available
    if recording_storage and voyage_service:
        logger.info("Initializing RAG retriever")
        rag_retriever = RAGRetriever(recording_storage, voyage_service)
        logger.info("RAG retriever initialized successfully")

    # Initialize shared MCP client on startup with retries
    logger.info("Initializing shared MCP client on startup")
    max_retries = 10
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            shared_mcp_client = MCPClient(os.getenv("MCP_SERVER_URL", "http://playwright-browser:3001"))
            await shared_mcp_client.connect()
            logger.info("Shared MCP client initialized successfully")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Failed to connect to MCP server (attempt {attempt + 1}/{max_retries}): {e}")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect to MCP server after {max_retries} attempts")
                raise


async def get_shared_mcp_client() -> MCPClient:
    """Get the shared MCP client."""
    global shared_mcp_client

    if shared_mcp_client is None:
        raise RuntimeError("Shared MCP client not initialized. This should not happen.")

    return shared_mcp_client


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connection_id = str(id(websocket))

    # Create agent for this connection with shared MCP client
    agent = BrowserAgent()
    agent.mcp_client = await get_shared_mcp_client()
    agent.rag_retriever = rag_retriever  # Set RAG retriever for context
    # Initialize chat without reinitializing MCP
    system_prompt = agent._build_system_prompt()
    agent.conversation_history = [
        {"role": "user", "parts": [system_prompt]},
        {"role": "model", "parts": ["Understood. I'm ready to help you interact with the browser. What would you like me to do?"]}
    ]
    agent.chat = agent.model.start_chat(history=agent.conversation_history)
    active_connections[connection_id] = (websocket, agent)

    logger.info(f"Client connected: {connection_id}")

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "set_recording":
                # Handle recording state change
                is_recording = message.get("recording", False)
                agent.set_recording(is_recording)
                logger.info(f"Recording state changed to: {is_recording}")
                await websocket.send_json({
                    "type": "recording_status",
                    "recording": is_recording,
                    "session_id": agent.recording_session_id
                })

            elif message.get("type") == "message":
                user_content = message.get("content", "")
                logger.info(f"Received message: {user_content}")

                # Check if we should inject demo content (first message only)
                demo_metadata = None
                if not agent.demo_injected:
                    demo_metadata = await agent.inject_demo_content()
                    if demo_metadata:
                        # Send memory message immediately
                        await websocket.send_json({
                            "type": "memory_injected",
                            "metadata": demo_metadata
                        })
                        logger.info("Sent memory_injected message to client")

                # Send status update
                await websocket.send_json({
                    "type": "status",
                    "content": "thinking"
                })

                # Process with agent
                try:
                    response = await agent.process_message(user_content)
                    await websocket.send_json({
                        "type": "response",
                        "content": response
                    })
                except Exception as e:
                    logger.error(f"Agent error: {e}")
                    await websocket.send_json({
                        "type": "response",
                        "content": f"Sorry, I encountered an error: {str(e)}"
                    })

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cleanup - don't disconnect shared MCP client
        if connection_id in active_connections:
            del active_connections[connection_id]


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


async def get_or_create_recording_agent() -> BrowserAgent:
    """Get or create the global recording agent with shared MCP client."""
    global recording_agent

    assert recording_agent_lock is not None, "recording_agent_lock not initialized"
    async with recording_agent_lock:
        if recording_agent is None:
            logger.info("Creating new recording agent")
            recording_agent = BrowserAgent()
            recording_agent.mcp_client = await get_shared_mcp_client()
            recording_agent.rag_retriever = rag_retriever  # Set RAG retriever for context
            # Initialize chat without reinitializing MCP
            system_prompt = recording_agent._build_system_prompt()
            recording_agent.conversation_history = [
                {"role": "user", "parts": [system_prompt]},
                {"role": "model", "parts": ["Understood. I'm ready to help you interact with the browser. What would you like me to do?"]}
            ]
            recording_agent.chat = recording_agent.model.start_chat(history=recording_agent.conversation_history)
            logger.info("Recording agent initialized with shared MCP client")
        return recording_agent


@app.post("/recording/start")
async def start_recording():
    """Enable recording mode"""
    agent = await get_or_create_recording_agent()
    agent.set_recording(True)
    return {
        "status": "recording",
        "recording": True,
        "session_id": agent.recording_session_id
    }


@app.post("/recording/stop")
async def stop_recording():
    """Disable recording mode"""
    global recording_agent

    if recording_agent:
        recording_agent.set_recording(False)

    return {"status": "stopped", "recording": False}


@app.post("/recording/screenshot")
async def capture_screenshot(event_type: str = "manual"):
    """Capture a screenshot during manual control"""
    agent = await get_or_create_recording_agent()

    if agent.is_recording:
        filename = await agent._capture_screenshot(event_type)
        return {"status": "captured", "filename": filename}

    return {"status": "not_recording", "filename": None}


@app.post("/recording/metadata")
async def save_recording_metadata(session_id: str = Form(...), description: str = Form(...)):
    """Save metadata for a recording session with vector embedding."""
    import re
    from datetime import datetime

    # Validate session_id format (timestamp_uuid)
    if not re.match(r'^\d{8}_\d{6}_[a-f0-9]{8}$', session_id):
        return {"status": "error", "message": "Invalid session_id format"}, 400

    # Validate description is non-empty
    if not description.strip():
        return {"status": "error", "message": "Description is required"}, 400

    try:
        description_clean = description.strip()

        # Find all screenshots for this session (both .jpg from video buffer and .png from legacy)
        screenshot_pattern_jpg = f"/tmp/screenshots/{session_id}_*.jpg"
        screenshot_pattern_png = f"/tmp/screenshots/{session_id}_*.png"
        screenshot_paths = sorted(glob.glob(screenshot_pattern_jpg) + glob.glob(screenshot_pattern_png))
        logger.info(f"Found {len(screenshot_paths)} screenshots for session {session_id}")

        # Create metadata object (still save JSON for backward compatibility)
        metadata = {
            "session_id": session_id,
            "description": description_clean,
            "created_at": datetime.now().isoformat(),
            "screenshot_count": len(screenshot_paths),
        }

        # Save to JSON file
        metadata_path = f"/tmp/screenshots/{session_id}_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        # Embed and store in MongoDB if services are available
        embedding = None
        stored_in_db = False

        if voyage_service:
            try:
                logger.info(f"Embedding description for session {session_id}")
                embedding = voyage_service.embed_document(description_clean)
                logger.info(f"Embedding created: {len(embedding)} dimensions")
            except Exception as e:
                logger.error(f"Failed to create embedding: {e}")

        if recording_storage and embedding:
            try:
                recording = RecordingSession(
                    session_id=session_id,
                    description=description_clean,
                    embedding=embedding,
                    screenshot_paths=screenshot_paths,
                )
                recording_storage.save_recording(recording)
                stored_in_db = True
                logger.info(f"Recording saved to MongoDB: {session_id}")
            except Exception as e:
                logger.error(f"Failed to save to MongoDB: {e}")

        logger.info(f"Metadata saved for session {session_id}: {description_clean[:50]}...")
        return {
            "status": "success",
            "metadata_path": metadata_path,
            "stored_in_db": stored_in_db,
            "screenshot_count": len(screenshot_paths),
        }

    except Exception as e:
        logger.error(f"Error saving metadata: {e}")
        return {"status": "error", "message": str(e)}, 500


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
