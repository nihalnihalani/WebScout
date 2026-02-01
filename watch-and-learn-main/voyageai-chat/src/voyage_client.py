"""VoyageAI client for embeddings and reranking."""

from typing import Optional
import voyageai

from .config import Config


class VoyageClient:
    """Client for VoyageAI embedding and reranking services."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize VoyageAI client.

        Args:
            api_key: VoyageAI API key. Uses Config.VOYAGE_API_KEY if not provided.
        """
        self.api_key = api_key or Config.VOYAGE_API_KEY
        self.client = voyageai.Client(api_key=self.api_key)
        self.embed_model = Config.VOYAGE_EMBED_MODEL
        self.rerank_model = Config.VOYAGE_RERANK_MODEL

    def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Embed documents for storage.

        Args:
            documents: List of document strings to embed.

        Returns:
            List of embedding vectors.
        """
        if not documents:
            return []

        result = self.client.embed(
            documents,
            model=self.embed_model,
            input_type="document"
        )
        return result.embeddings

    def embed_query(self, query: str) -> list[float]:
        """Embed a query for retrieval.

        Args:
            query: Query string to embed.

        Returns:
            Embedding vector for the query.
        """
        result = self.client.embed(
            [query],
            model=self.embed_model,
            input_type="query"
        )
        return result.embeddings[0]

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: Optional[int] = None
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
            model=self.rerank_model,
            top_k=top_k
        )

        return [
            {
                "index": r.index,
                "relevance_score": r.relevance_score,
                "document": r.document
            }
            for r in result.results
        ]
