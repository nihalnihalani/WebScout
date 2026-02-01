"""Data models for the chat application."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class ChatMessage:
    """Data model for a chat message."""

    content: str
    role: str  # "user" or "assistant"
    embedding: Optional[list[float]] = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "_id": self.id,
            "content": self.content,
            "role": self.role,
            "embedding": self.embedding,
            "timestamp": self.timestamp
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChatMessage":
        """Create ChatMessage from dictionary."""
        return cls(
            id=data.get("_id", str(uuid.uuid4())),
            content=data.get("content", ""),
            role=data.get("role", "user"),
            embedding=data.get("embedding"),
            timestamp=data.get("timestamp")
        )
