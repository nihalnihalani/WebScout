"""Configuration for python-agent service."""

import os


class Config:
    """Application configuration."""

    # MongoDB Atlas
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DATABASE: str = "watch_and_learn"
    MONGODB_RECORDINGS_COLLECTION: str = "recordings"

    # Voyage AI
    VOYAGE_API_KEY: str = os.getenv("VOYAGE_API_KEY", "")
    VOYAGE_EMBED_MODEL: str = "voyage-3"
    VOYAGE_RERANK_MODEL: str = "rerank-2"

    # RAG settings
    RETRIEVAL_K: int = 10  # Initial K-NN candidates
    RERANK_TOP_K: int = 3  # Final results after reranking
    MAX_IMAGES_PER_RECORDING: int = 5  # Max screenshots to load per recording

    # Image settings
    TARGET_IMAGE_WIDTH: int = 1280  # 720p width
    TARGET_IMAGE_HEIGHT: int = 720  # 720p height
