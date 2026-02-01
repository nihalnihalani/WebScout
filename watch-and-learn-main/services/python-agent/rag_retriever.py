"""RAG retriever for finding relevant recordings and loading images."""

import io
import logging
from pathlib import Path

from PIL import Image

from config import Config
from recording_models import RecordingSession, RetrievedRecording
from recording_storage import RecordingStorage
from voyage_service import VoyageService

logger = logging.getLogger(__name__)


class RAGRetriever:
    """Retrieves relevant recordings and their images for RAG context."""

    def __init__(
        self,
        storage: RecordingStorage,
        voyage: VoyageService,
    ):
        """Initialize RAG retriever.

        Args:
            storage: MongoDB storage for recordings.
            voyage: Voyage AI service for embeddings and reranking.
        """
        self.storage = storage
        self.voyage = voyage

    def retrieve(
        self,
        query: str,
        top_k: int | None = None,
    ) -> list[RetrievedRecording]:
        """Retrieve relevant recordings for a query.

        Args:
            query: The task or query to find relevant recordings for.
            top_k: Number of final results after reranking.

        Returns:
            List of RetrievedRecording with relevance scores.
        """
        top_k = top_k or Config.RERANK_TOP_K

        # Embed the query
        logger.info(f"Embedding query: {query[:50]}...")
        query_embedding = self.voyage.embed_query(query)

        # Initial retrieval via vector similarity
        logger.info(f"Searching for similar recordings (k={Config.RETRIEVAL_K})")
        similar = self.storage.search_similar(
            query_embedding,
            top_k=Config.RETRIEVAL_K,
        )

        if not similar:
            logger.info("No similar recordings found")
            return []

        logger.info(f"Found {len(similar)} candidate recordings")

        # Rerank using descriptions
        descriptions = [rec.description for rec, _ in similar]
        reranked = self.voyage.rerank(query, descriptions, top_k=top_k)

        # Build results with reranked scores
        results = []
        for item in reranked:
            idx = item["index"]
            recording, _ = similar[idx]
            results.append(
                RetrievedRecording(
                    session=recording,
                    relevance_score=item["relevance_score"],
                )
            )

        logger.info(f"Returning {len(results)} reranked recordings")
        return results

    def load_images_for_recording(
        self,
        recording: RecordingSession,
        max_images: int | None = None,
    ) -> list[tuple[bytes, str]]:
        """Load and downsample images for a recording.

        Args:
            recording: The recording to load images for.
            max_images: Maximum number of images to load.

        Returns:
            List of (image_bytes, mime_type) tuples.
        """
        max_images = max_images or Config.MAX_IMAGES_PER_RECORDING
        images = []

        # Select evenly spaced images if there are more than max_images
        paths = recording.screenshot_paths
        if len(paths) > max_images:
            # Take evenly spaced samples including first and last
            indices = [
                int(i * (len(paths) - 1) / (max_images - 1))
                for i in range(max_images)
            ]
            paths = [paths[i] for i in indices]

        for path in paths:
            try:
                img_bytes = self._load_and_downsample(path)
                if img_bytes:
                    images.append((img_bytes, "image/png"))
            except Exception as e:
                logger.warning(f"Failed to load image {path}: {e}")

        logger.info(f"Loaded {len(images)} images for recording {recording.session_id}")
        return images

    def _load_and_downsample(self, path: str) -> bytes | None:
        """Load an image and downsample to 720p if needed.

        Args:
            path: Path to the image file.

        Returns:
            PNG image bytes, or None if loading failed.
        """
        if not Path(path).exists():
            logger.warning(f"Image not found: {path}")
            return None

        with Image.open(path) as img:
            # Check if downsampling is needed
            target_w = Config.TARGET_IMAGE_WIDTH
            target_h = Config.TARGET_IMAGE_HEIGHT

            if img.width > target_w or img.height > target_h:
                # Calculate new size maintaining aspect ratio
                ratio = min(target_w / img.width, target_h / img.height)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
                logger.debug(f"Downsampled {path} from {img.width}x{img.height} to {new_size}")

            # Convert to PNG bytes
            buffer = io.BytesIO()
            img.save(buffer, format="PNG", optimize=True)
            return buffer.getvalue()

    def retrieve_with_images(
        self,
        query: str,
        top_k: int | None = None,
        max_images_per_recording: int | None = None,
    ) -> list[dict]:
        """Retrieve recordings with their images loaded.

        Args:
            query: The task or query to find relevant recordings for.
            top_k: Number of recordings to retrieve.
            max_images_per_recording: Max images to load per recording.

        Returns:
            List of dicts with 'recording', 'relevance_score', and 'images'.
        """
        recordings = self.retrieve(query, top_k=top_k)

        results = []
        for retrieved in recordings:
            images = self.load_images_for_recording(
                retrieved.session,
                max_images=max_images_per_recording,
            )
            results.append({
                "recording": retrieved.session,
                "relevance_score": retrieved.relevance_score,
                "images": images,
            })

        return results
