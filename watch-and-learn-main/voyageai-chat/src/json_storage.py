"""JSON file storage for debugging and backup."""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import Config
from .models import ChatMessage


class JSONStorage:
    """JSON file storage for chat message backup."""

    def __init__(self, file_path: Optional[str] = None):
        """Initialize JSON storage.

        Args:
            file_path: Path to JSON backup file. Uses Config if not provided.
        """
        self.file_path = Path(file_path or Config.JSON_BACKUP_PATH)
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        """Create the file and parent directories if they don't exist."""
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.file_path.exists():
            self._save_data({
                "version": "1.0",
                "created_at": datetime.utcnow().isoformat(),
                "messages": []
            })

    def _load_data(self) -> dict:
        """Load data from JSON file."""
        with open(self.file_path, "r") as f:
            return json.load(f)

    def _save_data(self, data: dict) -> None:
        """Save data to JSON file."""
        data["last_updated"] = datetime.utcnow().isoformat()
        data["message_count"] = len(data.get("messages", []))
        with open(self.file_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def save_message(self, message: ChatMessage) -> str:
        """Save a chat message to JSON backup.

        Args:
            message: ChatMessage to save.

        Returns:
            Message ID.
        """
        data = self._load_data()
        msg_dict = message.to_dict()
        # Convert datetime to string for JSON
        if isinstance(msg_dict.get("timestamp"), datetime):
            msg_dict["timestamp"] = msg_dict["timestamp"].isoformat()
        data["messages"].append(msg_dict)
        self._save_data(data)
        return message.id

    def get_all_messages(self) -> list[ChatMessage]:
        """Retrieve all messages from JSON backup."""
        data = self._load_data()
        return [ChatMessage.from_dict(msg) for msg in data.get("messages", [])]

    def get_all_embeddings(self) -> list[tuple[str, list[float]]]:
        """Get all message IDs and embeddings from JSON backup."""
        data = self._load_data()
        return [
            (msg["_id"], msg["embedding"])
            for msg in data.get("messages", [])
            if msg.get("embedding") is not None
        ]

    def get_messages_by_ids(self, ids: list[str]) -> list[ChatMessage]:
        """Retrieve messages by their IDs.

        Args:
            ids: List of message IDs.

        Returns:
            List of ChatMessage objects.
        """
        data = self._load_data()
        id_set = set(ids)
        return [
            ChatMessage.from_dict(msg)
            for msg in data.get("messages", [])
            if msg.get("_id") in id_set
        ]

    def get_recent_messages(self, limit: int = 10) -> list[ChatMessage]:
        """Get most recent messages.

        Args:
            limit: Maximum number of messages to return.

        Returns:
            List of recent ChatMessage objects.
        """
        data = self._load_data()
        messages = data.get("messages", [])
        recent = messages[-limit:] if len(messages) > limit else messages
        return [ChatMessage.from_dict(msg) for msg in recent]

    def clear_all(self) -> int:
        """Clear all messages from JSON backup."""
        data = self._load_data()
        count = len(data.get("messages", []))
        data["messages"] = []
        self._save_data(data)
        return count
