"""Pydantic models for structured agent responses."""

from pydantic import BaseModel


class ToolCall(BaseModel):
    """A tool call to execute via MCP."""

    name: str
    arguments: dict = {}


class AgentResponse(BaseModel):
    """Structured response from the LLM agent.

    Separates internal reasoning from actions and user-facing messages.
    """

    # Internal chain-of-thought reasoning (logged but not shown to user)
    thinking: str | None = None

    # Tool to execute (executed silently, not shown to user)
    tool_call: ToolCall | None = None

    # Message to display to the user (the only thing the user sees)
    user_message: str | None = None
