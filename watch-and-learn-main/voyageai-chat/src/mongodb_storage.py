"""MongoDB Atlas storage for chat messages with embeddings."""

from datetime import datetime
from typing import Optional
import uuid

from pymongo import MongoClient
from pymongo.collection import Collection

from .config import Config


class ChatMessage:
    """Data model for a chat message."""

    def __init__(
        self,
        content: str,
        role: str,
        embedding: Optional[list[float]] = None,
        message_id: Optional[str] = None,
        timestamp: Optional[datetime] = None
    ):
        self.id = message_id or str(uuid.uuid4())
        self.content = content
        self.role = role  # "user" or "assistant"
        self.embedding = embedding
        self.timestamp = timestamp or datetime.utcnow()

    def to_dict(self) -> dict:
        """Convert to dictionary for MongoDB storage."""
        return {
            "_id": self.id,
            "content": self.content,
            "role": self.role,
            "embedding": self.embedding,
            "timestamp": self.timestamp
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChatMessage":
        """Create ChatMessage from MongoDB document."""
        return cls(
            message_id=data.get("_id"),
            content=data.get("content", ""),
            role=data.get("role", "user"),
            embedding=data.get("embedding"),
            timestamp=data.get("timestamp")
        )


class MongoDBStorage:
    """MongoDB Atlas storage for chat messages."""

    def __init__(
        self,
        uri: Optional[str] = None,
        database: Optional[str] = None,
        collection: Optional[str] = None
    ):
        """Initialize MongoDB connection.

        Args:
            uri: MongoDB connection string. Uses Config if not provided.
            database: Database name. Uses Config if not provided.
            collection: Collection name. Uses Config if not provided.
        """
        self.uri = uri or Config.MONGODB_URI
        self.database_name = database or Config.MONGODB_DATABASE
        self.collection_name = collection or Config.MONGODB_COLLECTION

        self.client: Optional[MongoClient] = None
        self.collection: Optional[Collection] = None

    def connect(self) -> None:
        """Establish connection to MongoDB Atlas."""
        self.client = MongoClient(self.uri)
        db = self.client[self.database_name]
        self.collection = db[self.collection_name]

        # Create indexes
        self.collection.create_index("timestamp")
        self.collection.create_index("role")

    def close(self) -> None:
        """Close MongoDB connection."""
        if self.client:
            self.client.close()

    def save_message(self, message: ChatMessage) -> str:
        """Save a chat message to MongoDB.

        Args:
            message: ChatMessage to save.

        Returns:
            Message ID.
        """
        self.collection.insert_one(message.to_dict())
        return message.id

    def get_all_messages(self) -> list[ChatMessage]:
        """Retrieve all messages sorted by timestamp."""
        cursor = self.collection.find().sort("timestamp", 1)
        return [ChatMessage.from_dict(doc) for doc in cursor]

    def get_all_embeddings(self) -> list[tuple[str, list[float]]]:
        """Get all message IDs and embeddings.

        Returns:
            List of (message_id, embedding) tuples.
        """
        cursor = self.collection.find(
            {"embedding": {"$exists": True, "$ne": None}},
            {"_id": 1, "embedding": 1}
        )
        return [(doc["_id"], doc["embedding"]) for doc in cursor]

    def get_messages_by_ids(self, ids: list[str]) -> list[ChatMessage]:
        """Retrieve messages by their IDs.

        Args:
            ids: List of message IDs.

        Returns:
            List of ChatMessage objects.
        """
        cursor = self.collection.find({"_id": {"$in": ids}})
        return [ChatMessage.from_dict(doc) for doc in cursor]

    def get_recent_messages(self, limit: int = 10) -> list[ChatMessage]:
        """Get most recent messages.

        Args:
            limit: Maximum number of messages to return.

        Returns:
            List of recent ChatMessage objects.
        """
        cursor = self.collection.find().sort("timestamp", -1).limit(limit)
        messages = [ChatMessage.from_dict(doc) for doc in cursor]
        return list(reversed(messages))  # Return in chronological order

    def clear_all(self) -> int:
        """Delete all messages. Returns count of deleted documents."""
        result = self.collection.delete_many({})
        return result.deleted_count
