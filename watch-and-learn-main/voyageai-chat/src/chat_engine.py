"""Chat engine orchestrating the RAG pipeline."""

from .config import Config
from .voyage_client import VoyageClient
from .openai_client import OpenAIClient
from .models import ChatMessage
from .json_storage import JSONStorage
from .retriever import Retriever


class ChatEngine:
    """RAG-powered chat engine with VoyageAI embeddings."""

    def __init__(
        self,
        voyage_client: VoyageClient,
        openai_client: OpenAIClient,
        storage: JSONStorage,
        retriever: Retriever
    ):
        """Initialize chat engine.

        Args:
            voyage_client: VoyageClient for embeddings.
            openai_client: OpenAIClient for response generation.
            storage: JSONStorage for persistence.
            retriever: Retriever for semantic search.
        """
        self.voyage = voyage_client
        self.openai = openai_client
        self.storage = storage
        self.retriever = retriever

    def process_message(self, user_input: str) -> str:
        """Process a user message through the RAG pipeline.

        Steps:
        1. Embed and store user message
        2. Retrieve relevant context from history
        3. Generate response with context
        4. Store assistant response
        5. Return response

        Args:
            user_input: User's message.

        Returns:
            Assistant's response.
        """
        # Step 1: Embed and store user message
        user_embedding = self.voyage.embed_documents([user_input])[0]
        user_message = ChatMessage(
            content=user_input,
            role="user",
            embedding=user_embedding
        )
        self.storage.save_message(user_message)

        # Step 2: Retrieve relevant context
        context = self._retrieve_context(user_input)

        # Step 3: Generate response
        response_text = self.openai.generate_response(user_input, context)

        # Step 4: Store assistant response
        assistant_embedding = self.voyage.embed_documents([response_text])[0]
        assistant_message = ChatMessage(
            content=response_text,
            role="assistant",
            embedding=assistant_embedding
        )
        self.storage.save_message(assistant_message)

        return response_text

    def _retrieve_context(self, query: str) -> str:
        """Retrieve and format relevant context from message history.

        Args:
            query: User's query.

        Returns:
            Formatted context string.
        """
        # Get all embeddings from storage
        embeddings = self.storage.get_all_embeddings()

        if not embeddings:
            return ""

        # Initial K-NN retrieval
        similar_ids = self.retriever.retrieve_similar_ids(
            query, embeddings, k=Config.RETRIEVAL_K
        )

        if not similar_ids:
            return ""

        # Fetch full messages
        messages = self.storage.get_messages_by_ids(similar_ids)

        if not messages:
            return ""

        # Rerank for better relevance
        reranked = self.retriever.rerank_messages(
            query, messages, top_k=Config.RERANK_TOP_K
        )

        # Format context
        context_parts = []
        for msg in reranked:
            prefix = "User" if msg.role == "user" else "Assistant"
            context_parts.append(f"{prefix}: {msg.content}")

        return "\n\n".join(context_parts)

    def get_history(self, limit: int = 10) -> list[ChatMessage]:
        """Get recent chat history.

        Args:
            limit: Maximum messages to return.

        Returns:
            List of recent ChatMessage objects.
        """
        return self.storage.get_recent_messages(limit)

    def clear_history(self) -> int:
        """Clear all chat history.

        Returns:
            Number of messages deleted.
        """
        return self.storage.clear_all()
