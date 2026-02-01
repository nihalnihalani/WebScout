"""MCP client using official mcp library with SSE transport.

Uses a persistent SSE connection to maintain session state, preventing
element refs from becoming stale between tool calls.
"""

import base64
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class MCPTool:
    """Tool definition from MCP server."""

    name: str
    description: str
    input_schema: dict


@dataclass
class MCPImageContent:
    """Represents image content returned from MCP tool."""

    data: bytes  # Raw image bytes
    mime_type: str

    @classmethod
    def from_mcp_content(cls, content: Any) -> "MCPImageContent | None":
        """Create from MCP content object with image data."""
        # Handle both dict format and object format
        if hasattr(content, "data") and hasattr(content, "mimeType"):
            try:
                image_bytes = base64.b64decode(content.data)
                return cls(data=image_bytes, mime_type=content.mimeType)
            except Exception as e:
                logger.error(f"Failed to decode image data: {e}")
        elif isinstance(content, dict) and content.get("type") == "image":
            data = content.get("data", "")
            mime_type = content.get("mimeType", "image/png")
            try:
                image_bytes = base64.b64decode(data)
                return cls(data=image_bytes, mime_type=mime_type)
            except Exception as e:
                logger.error(f"Failed to decode image data: {e}")
        return None


@dataclass
class MCPToolResult:
    """Result from an MCP tool call, containing text and/or images."""

    text_content: list[str] = field(default_factory=list)
    images: list[MCPImageContent] = field(default_factory=list)
    raw_result: Any = None
    error: str | None = None

    @classmethod
    def from_mcp_response(cls, result: Any) -> "MCPToolResult":
        """Parse MCP tool response into structured result."""
        tool_result = cls(raw_result=result)

        # Handle error case
        if hasattr(result, "isError") and result.isError:
            # Extract error message from content
            if hasattr(result, "content"):
                for content in result.content:
                    if hasattr(content, "text"):
                        tool_result.error = content.text
                        break
            return tool_result

        # Parse content list from MCP response
        content_list = getattr(result, "content", [])
        if not isinstance(content_list, list):
            content_list = [content_list]

        for content in content_list:
            # Handle TextContent objects
            if hasattr(content, "text"):
                tool_result.text_content.append(content.text)
            # Handle ImageContent objects
            elif hasattr(content, "data") and hasattr(content, "mimeType"):
                image = MCPImageContent.from_mcp_content(content)
                if image:
                    tool_result.images.append(image)
                    logger.info(
                        f"Parsed image content: {image.mime_type}, "
                        f"{len(image.data)} bytes"
                    )
            # Handle dict format (fallback)
            elif isinstance(content, dict):
                content_type = content.get("type", "text")
                if content_type == "text":
                    tool_result.text_content.append(content.get("text", ""))
                elif content_type == "image":
                    image = MCPImageContent.from_mcp_content(content)
                    if image:
                        tool_result.images.append(image)

        return tool_result

    def has_images(self) -> bool:
        """Check if result contains any images."""
        return len(self.images) > 0

    def get_text(self) -> str:
        """Get combined text content."""
        return "\n".join(self.text_content)


class MCPClient:
    """Client for communicating with MCP server over SSE transport.

    Uses the official mcp library to maintain a persistent connection,
    preventing element refs from becoming stale between tool calls.
    """

    def __init__(self, server_url: str):
        self.server_url = server_url.rstrip("/")
        self.tools: list[MCPTool] = []
        self._client: Any = None
        self._session: Any = None
        self._is_connected: bool = False

    @property
    def is_connected(self) -> bool:
        """Return whether connected to MCP server."""
        return self._is_connected

    @property
    def sse_url(self) -> str:
        """Return the SSE endpoint URL."""
        # Convert http://host:port to http://host:port/sse
        return f"{self.server_url}/sse"

    async def connect(self) -> None:
        """Connect to the MCP server using SSE transport."""
        if self._is_connected:
            logger.warning("Already connected to MCP server")
            return

        try:
            from mcp import ClientSession
            from mcp.client.sse import sse_client

            logger.info(f"Connecting to MCP server at {self.sse_url}")

            # Create SSE client with long read timeout for persistent connection
            self._client = sse_client(
                url=self.sse_url,
                timeout=60.0,
                sse_read_timeout=3600.0,  # 1 hour for long-running sessions
            )
            read_stream, write_stream = await self._client.__aenter__()

            # Create and initialize session
            self._session = ClientSession(read_stream, write_stream)
            await self._session.__aenter__()
            await self._session.initialize()

            self._is_connected = True

            # List available tools
            tools_response = await self._session.list_tools()
            self.tools = [
                MCPTool(
                    name=tool.name,
                    description=tool.description or "",
                    input_schema=(
                        tool.inputSchema if hasattr(tool, "inputSchema") else {}
                    ),
                )
                for tool in tools_response.tools
            ]

            logger.info(f"Connected to MCP server with {len(self.tools)} tools")
            logger.debug(f"Available tools: {[t.name for t in self.tools]}")

        except Exception as e:
            logger.error(f"Failed to connect to MCP server: {e}")
            self._is_connected = False
            # Use fallback tools if connection fails
            self.tools = self._get_fallback_tools()
            raise

    def _get_fallback_tools(self) -> list[MCPTool]:
        """Fallback tools when MCP server is not available."""
        return [
            MCPTool(
                name="browser_navigate",
                description="Navigate to a URL",
                input_schema={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "URL to navigate to"}
                    },
                    "required": ["url"],
                },
            ),
            MCPTool(
                name="browser_click",
                description="Click on an element",
                input_schema={
                    "type": "object",
                    "properties": {
                        "element": {
                            "type": "string",
                            "description": "Element description",
                        },
                        "ref": {"type": "string", "description": "Element reference"},
                    },
                    "required": ["element", "ref"],
                },
            ),
            MCPTool(
                name="browser_type",
                description="Type text into an element",
                input_schema={
                    "type": "object",
                    "properties": {
                        "element": {
                            "type": "string",
                            "description": "Element description",
                        },
                        "ref": {"type": "string", "description": "Element reference"},
                        "text": {"type": "string", "description": "Text to type"},
                    },
                    "required": ["element", "ref", "text"],
                },
            ),
            MCPTool(
                name="browser_snapshot",
                description="Get accessibility snapshot of the page",
                input_schema={"type": "object", "properties": {}},
            ),
        ]

    async def call_tool(self, tool_name: str, arguments: dict) -> MCPToolResult:
        """Call a tool on the MCP server and return structured result."""
        if not self._is_connected or not self._session:
            return MCPToolResult(error="MCP client not connected")

        try:
            result = await self._session.call_tool(tool_name, arguments)
            return MCPToolResult.from_mcp_response(result)
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return MCPToolResult(error=f"Error executing tool: {e!s}")

    def get_tools_for_llm(self) -> list[dict]:
        """Get tool definitions in a format suitable for LLM function calling."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            }
            for tool in self.tools
        ]

    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        if not self._is_connected:
            return

        try:
            if self._session:
                await self._session.__aexit__(None, None, None)
                self._session = None

            if self._client:
                await self._client.__aexit__(None, None, None)
                self._client = None

            self._is_connected = False
            logger.info("Disconnected from MCP server")

        except Exception as e:
            logger.error(f"Error disconnecting from MCP server: {e}")
