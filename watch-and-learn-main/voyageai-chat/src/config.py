"""Configuration management for VoyageAI Chat Application."""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    # API Keys
    VOYAGE_API_KEY: str = os.getenv("VOYAGE_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Model settings
    VOYAGE_EMBED_MODEL: str = "voyage-3.5"
    VOYAGE_RERANK_MODEL: str = "rerank-2.5"
    OPENAI_MODEL: str = "gpt-4o"
    CONVERTER_MODEL: str = "gpt-4o-mini"  # Cheap model for text-to-JSON conversion

    # Retrieval settings
    RETRIEVAL_K: int = 5  # Number of documents for initial K-NN
    RERANK_TOP_K: int = 3  # Number of documents after reranking

    # Storage
    JSON_BACKUP_PATH: str = "data/chat_backup.json"

    @classmethod
    def validate(cls) -> list[str]:
        """Validate required configuration. Returns list of missing keys."""
        missing = []
        if not cls.VOYAGE_API_KEY:
            missing.append("VOYAGE_API_KEY")
        if not cls.OPENAI_API_KEY:
            missing.append("OPENAI_API_KEY")
        return missing
