"""Data models for recording sessions with vector embeddings."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


class RecordingSession(BaseModel):
    """A recorded teaching session with embedded description for RAG."""

    session_id: str = Field(..., description="Unique session identifier")
    description: str = Field(..., description="User's description of what was taught")
    embedding: list[float] | None = Field(None, description="Voyage AI embedding vector")
    screenshot_paths: list[str] = Field(default_factory=list, description="Paths to session screenshots")
    created_at: datetime = Field(default_factory=_utcnow)

    def to_mongo_dict(self) -> dict:
        """Convert to dictionary for MongoDB storage."""
        return {
            "_id": self.session_id,
            "description": self.description,
            "embedding": self.embedding,
            "screenshot_paths": self.screenshot_paths,
            "created_at": self.created_at,
        }

    @classmethod
    def from_mongo_dict(cls, data: dict) -> "RecordingSession":
        """Create RecordingSession from MongoDB document."""
        return cls(
            session_id=data["_id"],
            description=data.get("description", ""),
            embedding=data.get("embedding"),
            screenshot_paths=data.get("screenshot_paths", []),
            created_at=data.get("created_at", _utcnow()),
        )


class RetrievedRecording(BaseModel):
    """A recording retrieved via RAG with relevance score."""

    session: RecordingSession
    relevance_score: float = Field(..., description="Relevance score from reranking")
