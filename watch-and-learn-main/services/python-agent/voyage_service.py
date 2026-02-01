"""Voyage AI service for embeddings and reranking."""

import logging

import voyageai

from config import Config

logger = logging.getLogger(__name__)


class VoyageService:
    """Service for Voyage AI embeddings and reranking."""

    def __init__(self, api_key: str | None = None):
        """Initialize Voyage AI client."""
        self.api_key = api_key or Config.VOYAGE_API_KEY
        if not self.api_key:
            raise ValueError("VOYAGE_API_KEY is required")
        self.client = voyageai.Client(api_key=self.api_key)

    def embed_document(self, text: str) -> list[float]:
        """Embed a document for storage.

        Args:
            text: Document text to embed.

        Returns:
            Embedding vector.
        """
        result = self.client.embed(
            [text],
            model=Config.VOYAGE_EMBED_MODEL,
            input_type="document",
        )
        return result.embeddings[0]

    def embed_query(self, query: str) -> list[float]:
        """Embed a query for retrieval.

        Args:
            query: Query text to embed.

        Returns:
            Embedding vector.
        """
        result = self.client.embed(
            [query],
            model=Config.VOYAGE_EMBED_MODEL,
            input_type="query",
        )
        return result.embeddings[0]

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int | None = None,
    ) -> list[dict]:
        """Rerank documents by relevance to query.

        Args:
            query: Query string.
            documents: List of documents to rerank.
            top_k: Number of top results to return.

        Returns:
            List of dicts with 'index', 'relevance_score', and 'document'.
        """
        if not documents:
            return []

        top_k = top_k or Config.RERANK_TOP_K

        result = self.client.rerank(
            query,
            documents,
            model=Config.VOYAGE_RERANK_MODEL,
            top_k=top_k,
        )

        return [
            {
                "index": r.index,
                "relevance_score": r.relevance_score,
                "document": r.document,
            }
            for r in result.results
        ]
