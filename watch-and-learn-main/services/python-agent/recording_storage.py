"""MongoDB storage for recording sessions with vector search."""

import logging

import numpy as np
from pymongo import MongoClient
from pymongo.collection import Collection
from sklearn.metrics.pairwise import cosine_similarity

from config import Config
from recording_models import RecordingSession

logger = logging.getLogger(__name__)


class RecordingStorage:
    """MongoDB storage for recording sessions with vector similarity search."""

    def __init__(
        self,
        uri: str | None = None,
        database: str | None = None,
        collection: str | None = None,
    ):
        """Initialize MongoDB connection settings."""
        self.uri = uri or Config.MONGODB_URI
        self.database_name = database or Config.MONGODB_DATABASE
        self.collection_name = collection or Config.MONGODB_RECORDINGS_COLLECTION

        self.client: MongoClient | None = None
        self.collection: Collection | None = None

    def connect(self) -> None:
        """Establish connection to MongoDB Atlas."""
        logger.info(f"Connecting to MongoDB: {self.database_name}/{self.collection_name}")

        # Connection options for MongoDB Atlas with better SSL/TLS handling
        self.client = MongoClient(
            self.uri,
            tls=True,  # Enable TLS/SSL
            tlsAllowInvalidCertificates=False,  # Validate certificates
            serverSelectionTimeoutMS=10000,  # 10 second timeout for faster startup
            connectTimeoutMS=10000,  # 10 second connection timeout
            socketTimeoutMS=10000,  # 10 second socket timeout
            retryWrites=True,  # Enable retryable writes
            w='majority',  # Wait for majority acknowledgment
            directConnection=False,  # Let driver handle replica set discovery
            retryReads=True,  # Enable retryable reads
        )

        # Test connection with ping
        try:
            self.client.admin.command('ping')
            logger.info("MongoDB connection test successful")
        except Exception as e:
            logger.warning(f"Initial ping failed, but continuing: {e}")

        db = self.client[self.database_name]
        self.collection = db[self.collection_name]

        # Create indexes (this will also test connection)
        try:
            self.collection.create_index("created_at")
            logger.info("MongoDB connection established")
        except Exception as e:
            logger.error(f"Failed to create index: {e}")
            raise

    def close(self) -> None:
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

    def save_recording(self, recording: RecordingSession) -> str:
        """Save a recording session to MongoDB.

        Args:
            recording: RecordingSession to save.

        Returns:
            Session ID.
        """
        if self.collection is None:
            raise RuntimeError("Not connected to MongoDB. Call connect() first.")

        self.collection.replace_one(
            {"_id": recording.session_id},
            recording.to_mongo_dict(),
            upsert=True,
        )
        logger.info(f"Saved recording: {recording.session_id}")
        return recording.session_id

    def get_recording(self, session_id: str) -> RecordingSession | None:
        """Get a recording by session ID."""
        if self.collection is None:
            raise RuntimeError("Not connected to MongoDB. Call connect() first.")

        doc = self.collection.find_one({"_id": session_id})
        if doc:
            return RecordingSession.from_mongo_dict(doc)
        return None

    def get_all_recordings(self) -> list[RecordingSession]:
        """Get all recordings sorted by creation time."""
        if self.collection is None:
            raise RuntimeError("Not connected to MongoDB. Call connect() first.")

        cursor = self.collection.find().sort("created_at", -1)
        return [RecordingSession.from_mongo_dict(doc) for doc in cursor]

    def get_recordings_with_embeddings(self) -> list[RecordingSession]:
        """Get all recordings that have embeddings."""
        if self.collection is None:
            raise RuntimeError("Not connected to MongoDB. Call connect() first.")

        cursor = self.collection.find(
            {"embedding": {"$exists": True, "$ne": None}}
        )
        return [RecordingSession.from_mongo_dict(doc) for doc in cursor]

    def search_similar(
        self,
        query_embedding: list[float],
        top_k: int = 10,
    ) -> list[tuple[RecordingSession, float]]:
        """Find recordings similar to query using cosine similarity.

        Args:
            query_embedding: Query embedding vector.
            top_k: Number of results to return.

        Returns:
            List of (RecordingSession, similarity_score) tuples.
        """
        if self.collection is None:
            raise RuntimeError("Not connected to MongoDB. Call connect() first.")

        # Get all recordings with embeddings
        recordings = self.get_recordings_with_embeddings()
        if not recordings:
            return []

        # Build embedding matrix
        embeddings = []
        valid_recordings = []
        for rec in recordings:
            if rec.embedding:
                embeddings.append(rec.embedding)
                valid_recordings.append(rec)

        if not embeddings:
            return []

        # Compute cosine similarity
        query_vec = np.array(query_embedding).reshape(1, -1)
        embedding_matrix = np.array(embeddings)
        similarities = cosine_similarity(query_vec, embedding_matrix)[0]

        # Sort by similarity and return top_k
        scored = list(zip(valid_recordings, similarities, strict=False))
        scored.sort(key=lambda x: x[1], reverse=True)

        return scored[:top_k]

    def delete_recording(self, session_id: str) -> bool:
        """Delete a recording by session ID."""
        if self.collection is None:
            raise RuntimeError("Not connected to MongoDB. Call connect() first.")

        result = self.collection.delete_one({"_id": session_id})
        return result.deleted_count > 0
