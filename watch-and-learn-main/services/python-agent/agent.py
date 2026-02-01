import asyncio
import base64
import json
import logging
import os
import random
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING
from uuid import uuid4

import aiohttp
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types.content import Part as GenaiPart
from google.api_core import exceptions as google_exceptions
from pydantic import ValidationError

from mcp_client import MCPClient, MCPToolResult
from models import AgentResponse
from prompts import TOOL_RESULT_REMINDER, TOOL_RESULT_REMINDER_WITH_IMAGE, build_system_prompt

if TYPE_CHECKING:
    from rag_retriever import RAGRetriever

logger = logging.getLogger(__name__)

# MCP Server URL
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://playwright-browser:3001")

# Video Buffer Server URL (for historical frame queries)
VIDEO_BUFFER_URL = os.getenv("VIDEO_BUFFER_URL", "http://playwright-browser:8766")

# Maximum iterations for the agentic loop to prevent infinite loops
MAX_ITERATIONS = 30

# Maximum consecutive failures per step before asking user for guidance
MAX_RETRIES_PER_STEP = 3

# Exponential backoff settings for API rate limiting (429 errors)
API_MAX_RETRIES = 5
API_BASE_DELAY = 1.0  # Base delay in seconds
API_MAX_DELAY = 60.0  # Maximum delay in seconds
API_EXPONENTIAL_BASE = 2  # Exponential backoff multiplier

# Logs directory for dumping context
LOGS_DIR = Path("/app/logs")

# Demo directory for image demonstrations
DEMO_DIR = Path(os.getenv("DEMO_DIR", "/app/demo"))

# Whether to load demo content (disabled by default)
DEMO_ENABLED = os.getenv("DEMO_ENABLED", "false").lower() in ("true", "1", "yes")


class BrowserAgent:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")
        self.chat = None
        self.mcp_client: MCPClient | None = None
        self.rag_retriever: RAGRetriever | None = None
        self.conversation_history = []
        self.is_recording = False
        self.screenshot_counter = 0
        self.demo_injected = False
        self.recording_session_id: str | None = None

    async def _send_message_with_retry(self, message) -> str:
        """Send a message to Gemini with exponential backoff for rate limiting.

        Args:
            message: The message to send (string or list of parts).

        Returns:
            The response text from Gemini.

        Raises:
            Exception: If all retries are exhausted.
        """
        last_exception = None

        for attempt in range(API_MAX_RETRIES):
            try:
                response = await self.chat.send_message_async(message)
                return response.text
            except google_exceptions.ResourceExhausted as e:
                last_exception = e
                if attempt < API_MAX_RETRIES - 1:
                    # Calculate delay with exponential backoff and jitter
                    delay = min(
                        API_BASE_DELAY * (API_EXPONENTIAL_BASE ** attempt),
                        API_MAX_DELAY
                    )
                    # Add jitter (±25%)
                    jitter = delay * 0.25 * (2 * random.random() - 1)
                    delay = delay + jitter

                    logger.warning(
                        f"Rate limited (429). Retrying in {delay:.1f}s "
                        f"(attempt {attempt + 1}/{API_MAX_RETRIES})"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Rate limit retries exhausted after {API_MAX_RETRIES} attempts")
            except Exception:
                # For non-rate-limit errors, don't retry
                raise

        # All retries exhausted
        raise last_exception or Exception("Rate limit retries exhausted")

    async def initialize(self):
        """Initialize the agent and connect to MCP server."""
        self.mcp_client = MCPClient(MCP_SERVER_URL)
        await self.mcp_client.connect()

        # Initialize chat with system prompt
        system_prompt = self._build_system_prompt()
        self.conversation_history = [
            {"role": "user", "parts": [system_prompt]},
            {"role": "model", "parts": ["Understood. I'm ready to help you interact with the browser. What would you like me to do?"]}
        ]

        self.chat = self.model.start_chat(history=self.conversation_history)

    def _load_demo_content(self) -> tuple[list | None, dict | None]:
        """Load demo images and description from the demo folder.

        Returns a tuple of:
            - list of message parts (text + images) if demo content exists, or None
            - dict with metadata (description, thumbnail_base64) for UI display, or None
        """
        if not DEMO_ENABLED:
            logger.info("Demo content disabled via DEMO_ENABLED env var")
            return None, None

        if not DEMO_DIR.exists():
            logger.info(f"Demo directory not found: {DEMO_DIR}")
            return None, None

        description_path = DEMO_DIR / "description.txt"
        if not description_path.exists():
            logger.info(f"Demo description not found: {description_path}")
            return None, None

        # Read the description
        description_text = description_path.read_text().strip()

        # Find all image files, sorted by name (ignore prompt.txt)
        image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
        image_files = sorted(
            f for f in DEMO_DIR.iterdir()
            if f.suffix.lower() in image_extensions
        )

        if not image_files:
            logger.info(f"No demo images found in {DEMO_DIR}")
            return None, None

        # Build the message parts
        parts: list[str | genai.protos.Part] = []

        # Add introductory text with description
        intro_text = (
            "Here is a demonstration of how to complete a similar task. "
            "Use these images as a reference for how to interact with the browser.\n\n"
            f"Task description: {description_text}\n\n"
            "The following images show the step-by-step process:"
        )
        parts.append(intro_text)

        # Track first image for thumbnail
        thumbnail_base64 = None

        # Add each image
        for i, image_path in enumerate(image_files):
            try:
                image_data = image_path.read_bytes()
                # Determine mime type
                suffix = image_path.suffix.lower()
                mime_type = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".gif": "image/gif",
                    ".webp": "image/webp",
                }.get(suffix, "image/png")

                image_part = genai.protos.Part(
                    inline_data={"mime_type": mime_type, "data": image_data}
                )
                parts.append(image_part)
                logger.info(f"Loaded demo image: {image_path.name} ({len(image_data)} bytes)")

                # Use first image as thumbnail
                if i == 0:
                    thumbnail_base64 = f"data:{mime_type};base64,{base64.b64encode(image_data).decode()}"
            except Exception as e:
                logger.warning(f"Failed to load demo image {image_path}: {e}")

        logger.info(f"Loaded {len(image_files)} demo images")

        metadata = {
            "description": description_text,
            "thumbnail": thumbnail_base64,
            "image_count": len(image_files),
        }

        return parts, metadata

    async def inject_demo_content(self) -> dict | None:
        """Inject demo content into the conversation.

        Should be called before the first user message.
        Returns metadata for UI display, or None if no demo available.
        """
        if self.chat is None:
            raise RuntimeError("Agent not initialized. Call initialize() first.")

        if self.demo_injected:
            return None

        self.demo_injected = True
        demo_parts, metadata = self._load_demo_content()

        if demo_parts:
            await self._send_message_with_retry(demo_parts)
            logger.info("Injected demo content into conversation")
            return metadata

        return None

    def _build_system_prompt(self) -> str:
        """Build system prompt with available tools and their parameter schemas."""
        tools = self.mcp_client.get_tools_for_llm() if self.mcp_client else []
        return build_system_prompt(tools)

    def set_recording(self, enabled: bool):
        """Enable or disable recording mode."""
        self.is_recording = enabled
        if enabled:
            # Generate a new session ID
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            session_uuid = str(uuid4())[:8]
            self.recording_session_id = f"{timestamp}_{session_uuid}"
            self.screenshot_counter = 0
            # Create screenshots directory if it doesn't exist
            os.makedirs("/tmp/screenshots", exist_ok=True)
            logger.info(f"Recording mode enabled - Session ID: {self.recording_session_id}")
        else:
            logger.info(f"Recording mode disabled - Session ID: {self.recording_session_id}")
            self.recording_session_id = None

    async def _capture_screenshot(self, event_type: str, offset_ms: int = 100) -> str | None:
        """Capture a screenshot from video buffer and save it locally.

        Args:
            event_type: Description of the event (e.g., "before_browser_click")
            offset_ms: How many milliseconds in the past to retrieve frame (default: 100)

        Returns:
            Path to saved screenshot file, or None if failed
        """
        try:
            # Query video buffer for historical frame
            url = f"{VIDEO_BUFFER_URL}/frame?offset_ms={offset_ms}"
            logger.debug(f"Requesting frame from video buffer: {url} (event: {event_type})")

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 404:
                        logger.warning(f"No frame available in buffer for offset {offset_ms}ms")
                        return None
                    elif response.status != 200:
                        logger.error(f"Frame request failed with status {response.status}: {await response.text()}")
                        return None

                    # Read JPEG data
                    frame_data = await response.read()

            if not frame_data:
                logger.warning(f"Empty frame data received for event: {event_type}")
                return None

            # Save screenshot to file
            self.screenshot_counter += 1

            # Include session ID in filename
            session_part = f"{self.recording_session_id}_" if self.recording_session_id else ""
            filename = f"/tmp/screenshots/{session_part}{self.screenshot_counter:04d}_{event_type}.jpg"

            with open(filename, "wb") as f:
                f.write(frame_data)

            logger.info(f"Screenshot captured from buffer: {filename} (event: {event_type}, offset: {offset_ms}ms)")
            return filename

        except TimeoutError:
            logger.error(f"Timeout while requesting frame from video buffer for event: {event_type}")
            return None
        except Exception as e:
            logger.error(f"Exception while capturing screenshot: {e}", exc_info=True)
            return None

    async def _execute_tool(self, tool_name: str, arguments: dict) -> MCPToolResult:
        """Execute a tool via MCP client and return structured result."""
        if not self.mcp_client:
            return MCPToolResult(error="MCP client not connected")

        try:
            # Capture screenshot before action if recording (from 100ms ago buffer)
            if self.is_recording and tool_name in ["browser_click", "browser_type"]:
                await self._capture_screenshot(f"before_{tool_name}", offset_ms=100)

            result = await self.mcp_client.call_tool(tool_name, arguments)

            return result
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return MCPToolResult(error=f"Error executing tool: {str(e)}")

    def _parse_response(self, text: str) -> AgentResponse:
        """Parse LLM response into structured AgentResponse.

        Attempts to extract JSON from the response and validate it against
        the AgentResponse schema. Falls back to extracting user_message field
        or treating the entire response as a user message if parsing fails.
        """
        json_str = None

        try:
            # Try to find JSON code block
            if '```json' in text:
                block_start = text.find('```json')
                end = text.find('```', block_start + 7)
                if end > block_start:
                    json_str = text[block_start + 7:end].strip()

            # Try to find inline JSON object
            elif text.strip().startswith('{'):
                # Find matching closing brace
                brace_count = 0
                start = text.find('{')
                end = start
                for i, char in enumerate(text[start:], start):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end = i + 1
                            break
                if end > start:
                    json_str = text[start:end]

            if json_str:
                data = json.loads(json_str)
                return AgentResponse.model_validate(data)

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON from response: {e}")
            # Try to extract user_message using regex as fallback
            extracted = self._extract_user_message_fallback(json_str or text)
            if extracted:
                return AgentResponse(user_message=extracted)
        except ValidationError as e:
            logger.warning(f"Response validation failed: {e}")

        # Final fallback: treat the entire response as a user message
        logger.warning("Falling back to treating response as plain user message")
        return AgentResponse(user_message=text)

    def _extract_user_message_fallback(self, text: str) -> str | None:
        """Try to extract user_message from malformed JSON using regex.

        When JSON parsing fails due to control characters or formatting issues,
        this attempts to extract just the user_message field value.
        """
        import re

        # Try to find "user_message": "..." pattern
        # Handle both single and multi-line values
        pattern = r'"user_message"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]'
        match = re.search(pattern, text, re.DOTALL)

        if match:
            # Unescape the captured string
            raw_value = match.group(1)
            try:
                # Use json.loads to properly unescape the string
                unescaped = json.loads(f'"{raw_value}"')
                logger.info("Successfully extracted user_message via regex fallback")
                return unescaped
            except json.JSONDecodeError:
                # If unescaping fails, return the raw value with basic cleanup
                logger.info("Using raw user_message from regex fallback")
                return raw_value.replace('\\n', '\n').replace('\\"', '"')

        return None

    def _build_tool_result_message(self, tool_name: str, result: MCPToolResult) -> list:
        """Build a multimodal message from tool result for Gemini."""
        parts: list[str | GenaiPart] = []

        # Add text description
        if result.error:
            parts.append(f"Tool '{tool_name}' failed with error: {result.error}")
        else:
            text_content = result.get_text()
            if text_content:
                parts.append(f"Tool '{tool_name}' executed. Result:\n```\n{text_content}\n```")
            else:
                parts.append(f"Tool '{tool_name}' executed successfully.")

        # Add images using protos.Part with inline_data dict
        for image in result.images:
            image_part = genai.protos.Part(
                inline_data={"mime_type": image.mime_type, "data": image.data}
            )
            parts.append(image_part)
            logger.info(f"Adding image to message: {image.mime_type}, {len(image.data)} bytes")

        # Add instruction for model (remind to use structured format)
        if result.has_images():
            parts.append(TOOL_RESULT_REMINDER_WITH_IMAGE)
        else:
            parts.append(TOOL_RESULT_REMINDER)

        return parts

    def _build_rag_context(self, query: str) -> list | None:
        """Build RAG context with relevant recordings and their images.

        Args:
            query: The user's message/task to find relevant recordings for.

        Returns:
            List of message parts with context, or None if no relevant recordings.
        """
        if not self.rag_retriever:
            return None

        try:
            results = self.rag_retriever.retrieve_with_images(query)
            if not results:
                logger.info("No relevant recordings found for RAG context")
                return None

            parts: list[str | GenaiPart] = []

            # Add context header
            parts.append(
                "I found some relevant recordings from previous teaching sessions "
                "that may help with this task. Here are examples of similar tasks "
                "that were demonstrated before:\n"
            )

            for i, result in enumerate(results, 1):
                recording = result["recording"]
                score = result["relevance_score"]
                images = result["images"]

                parts.append(
                    f"\n--- Recording {i} (relevance: {score:.2f}) ---\n"
                    f"Description: {recording.description}\n"
                    f"Screenshots ({len(images)} images):\n"
                )

                # Add images
                for img_bytes, mime_type in images:
                    image_part = genai.protos.Part(
                        inline_data={"mime_type": mime_type, "data": img_bytes}
                    )
                    parts.append(image_part)

            parts.append(
                "\n--- End of recordings ---\n"
                "Use these examples as reference for how to approach the current task.\n"
            )

            logger.info(
                f"Built RAG context with {len(results)} recordings, "
                f"{sum(len(r['images']) for r in results)} total images"
            )
            return parts

        except Exception as e:
            logger.error(f"Failed to build RAG context: {e}")
            return None

    def _dump_context(self, trigger: str) -> None:
        """Dump the current chat context to a JSON file for debugging.

        Args:
            trigger: Description of what triggered the dump (e.g., "after_message")
        """
        if not LOGS_DIR.exists():
            LOGS_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = LOGS_DIR / f"context_{timestamp}_{trigger}.json"

        # Stats counters
        total_messages = 0
        total_chars = 0
        total_images = 0

        # Serialize the chat history
        history: list[dict] = []

        if self.chat and hasattr(self.chat, "history"):
            for msg in self.chat.history:
                serialized_parts: list[dict] = []
                role = msg.role if hasattr(msg, "role") else "unknown"

                parts = msg.parts if hasattr(msg, "parts") else []
                for part in parts:
                    if hasattr(part, "text"):
                        # Text part
                        text = part.text
                        serialized_parts.append({
                            "type": "text",
                            "content": text,
                            "char_count": len(text),
                        })
                        total_chars += len(text)
                    elif hasattr(part, "inline_data"):
                        # Image/binary part
                        size = 0
                        if hasattr(part.inline_data, "data"):
                            size = len(part.inline_data.data)
                        serialized_parts.append({
                            "type": "image",
                            "mime_type": getattr(part.inline_data, "mime_type", "unknown"),
                            "size_bytes": size,
                        })
                        total_images += 1
                    else:
                        # Unknown part type
                        serialized_parts.append({
                            "type": "unknown",
                            "repr": str(part)[:200],
                        })

                history.append({"role": role, "parts": serialized_parts})
                total_messages += 1

        context_data = {
            "timestamp": datetime.now().isoformat(),
            "trigger": trigger,
            "history": history,
            "stats": {
                "total_messages": total_messages,
                "total_chars": total_chars,
                "total_images": total_images,
            },
        }

        # Write to file
        with open(filename, "w") as f:
            json.dump(context_data, f, indent=2, default=str)

        logger.info(
            f"Context dumped to {filename} "
            f"(messages={total_messages}, "
            f"chars={total_chars}, "
            f"images={total_images})"
        )

    async def process_message(self, user_message: str) -> str:
        """Process a user message and return a response.

        Uses an agentic loop that continues executing tools until the LLM
        responds without a tool call, or max iterations is reached.

        Only user_message fields from the structured response are returned
        to the user. Thinking is logged internally, and tool calls are
        executed silently.
        """
        if self.chat is None:
            raise RuntimeError("Agent not initialized. Call initialize() first.")

        try:
            # Build RAG context if available
            rag_context = self._build_rag_context(user_message)

            # Build the message parts
            if rag_context:
                # Multimodal message with RAG context + user message
                message_parts = rag_context + [f"\nUser request: {user_message}"]
                logger.info("Sending message with RAG context")
            else:
                message_parts = user_message

            # Send initial message to Gemini (with retry for rate limiting)
            response_text = await self._send_message_with_retry(message_parts)

            # Collect user messages to return at the end
            user_messages: list[str] = []

            # Agentic loop: keep executing tools until LLM stops requesting them
            iterations = 0
            consecutive_failures = 0
            while iterations < MAX_ITERATIONS:
                # Parse the structured response
                parsed = self._parse_response(response_text)

                # Log thinking (internal, not shown to user)
                if parsed.thinking:
                    logger.info(f"Agent thinking: {parsed.thinking}")

                # Collect any user message
                if parsed.user_message:
                    user_messages.append(parsed.user_message)

                # Check if there's a tool call to execute
                if not parsed.tool_call:
                    # No tool call - we're done, return collected messages
                    break

                iterations += 1
                tool_name = parsed.tool_call.name
                arguments = parsed.tool_call.arguments
                logger.info(
                    f"Iteration {iterations}/{MAX_ITERATIONS}: "
                    f"Executing tool: {tool_name} with args: {arguments}"
                )

                # Execute the tool
                result = await self._execute_tool(tool_name, arguments)
                result_text = result.get_text()
                logger.info(
                    f"Tool result: {result_text[:500] if result_text else 'No text'}..."
                )

                if result.has_images():
                    logger.info(f"Tool returned {len(result.images)} image(s)")

                # Track consecutive failures per step
                if result.error:
                    consecutive_failures += 1
                    logger.warning(
                        f"Tool failed ({consecutive_failures}/{MAX_RETRIES_PER_STEP}): "
                        f"{result.error}"
                    )
                    if consecutive_failures >= MAX_RETRIES_PER_STEP:
                        logger.error(
                            f"Max retries ({MAX_RETRIES_PER_STEP}) reached for step"
                        )
                        self._dump_context("max_retries_per_step_reached")
                        user_messages.append(
                            f"I've encountered {MAX_RETRIES_PER_STEP} consecutive "
                            f"failures trying to complete this action. Last error: "
                            f"{result.error}\n\nPlease provide guidance on how to "
                            "proceed or try a different approach."
                        )
                        break
                else:
                    # Success - reset the failure counter
                    if consecutive_failures > 0:
                        logger.info(
                            f"Tool succeeded, resetting failure counter "
                            f"(was {consecutive_failures})"
                        )
                    consecutive_failures = 0

                # Build multimodal message with tool result (includes errors)
                follow_up_parts = self._build_tool_result_message(tool_name, result)

                # Send result to Gemini and get next response (with retry for rate limiting)
                response_text = await self._send_message_with_retry(follow_up_parts)

                # Dump context after each tool execution for debugging
                self._dump_context(f"after_tool_{tool_name}_iter{iterations}")

            else:
                # Max iterations reached (while loop completed without break)
                logger.warning(f"Max iterations ({MAX_ITERATIONS}) reached")
                self._dump_context("max_iterations_reached")
                user_messages.append(
                    "I've reached the maximum number of actions I can take for this "
                    "request. Please try a simpler request or provide more specific "
                    "instructions."
                )

            # Dump final context
            self._dump_context("end_of_message")

            # Return collected user messages (or a default if none)
            if user_messages:
                return "\n\n".join(user_messages)
            return "Task completed."

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            # Dump context on error for debugging
            self._dump_context(f"error_{type(e).__name__}")
            raise

    async def cleanup(self):
        """Cleanup resources."""
        if self.mcp_client:
            await self.mcp_client.disconnect()
