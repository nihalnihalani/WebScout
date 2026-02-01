"""OpenAI client for response generation."""

from typing import Optional
from openai import OpenAI

from .config import Config


class OpenAIClient:
    """Client for OpenAI chat completions."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize OpenAI client.

        Args:
            api_key: OpenAI API key. Uses Config.OPENAI_API_KEY if not provided.
        """
        self.api_key = api_key or Config.OPENAI_API_KEY
        self.client = OpenAI(api_key=self.api_key)
        self.model = Config.OPENAI_MODEL

    def generate_response(
        self,
        query: str,
        context: str = "",
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate a response using retrieved context.

        Args:
            query: User's query.
            context: Retrieved context from past conversations.
            system_prompt: Optional system prompt override.

        Returns:
            Generated response string.
        """
        if system_prompt is None:
            system_prompt = (
                "You are a helpful assistant. Use the provided conversation "
                "history context to inform your responses when relevant. "
                "If the context is empty or not relevant, respond based on "
                "general knowledge."
            )

        if context:
            user_content = (
                f"Relevant conversation history:\n{context}\n\n"
                f"---\nCurrent question: {query}\n\n"
                "Please provide a helpful response."
            )
        else:
            user_content = query

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        )

        return response.choices[0].message.content
