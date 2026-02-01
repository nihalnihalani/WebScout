"""Retriever for semantic search using cosine similarity."""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from .config import Config
from .voyage_client import VoyageClient
from .models import ChatMessage


class Retriever:
    """Retrieves relevant messages using K-NN and reranking."""

    def __init__(self, voyage_client: VoyageClient):
        """Initialize retriever.

        Args:
            voyage_client: VoyageClient instance for embeddings and reranking.
        """
        self.voyage = voyage_client

    def retrieve_similar_ids(
        self,
        query: str,
        message_embeddings: list[tuple[str, list[float]]],
        k: int = None
    ) -> list[str]:
        """Retrieve top-k most similar message IDs.

        Args:
            query: User's query string.
            message_embeddings: List of (message_id, embedding) tuples.
            k: Number of results to return.

        Returns:
            List of message IDs sorted by relevance.
        """
        if not message_embeddings:
            return []

        k = k or Config.RETRIEVAL_K

        # Embed the query with input_type="query"
        query_embedding = self.voyage.embed_query(query)

        # Extract IDs and embeddings
        ids = [item[0] for item in message_embeddings]
        embeddings = np.array([item[1] for item in message_embeddings])

        # Calculate cosine similarity
        query_vec = np.array(query_embedding).reshape(1, -1)
        similarities = cosine_similarity(query_vec, embeddings)[0]

        # Get top-k indices (limit k to available embeddings)
        k = min(k, len(ids))
        top_indices = np.argsort(similarities)[::-1][:k]

        return [ids[i] for i in top_indices]

    def rerank_messages(
        self,
        query: str,
        messages: list[ChatMessage],
        top_k: int = None
    ) -> list[ChatMessage]:
        """Rerank messages using VoyageAI reranker.

        Args:
            query: Query string.
            messages: List of ChatMessage objects to rerank.
            top_k: Number of top results to return.

        Returns:
            Reranked list of ChatMessage objects.
        """
        if not messages:
            return []

        top_k = top_k or Config.RERANK_TOP_K
        top_k = min(top_k, len(messages))

        documents = [msg.content for msg in messages]
        reranked = self.voyage.rerank(query, documents, top_k=top_k)

        return [messages[result["index"]] for result in reranked]
