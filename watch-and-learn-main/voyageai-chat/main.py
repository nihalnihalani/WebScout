#!/usr/bin/env python3
"""
VoyageAI RAG Chat Application

A CLI chat application that stores messages with VoyageAI embeddings
in JSON file storage.

Usage:
    python main.py
"""

import sys

from src.config import Config
from src.voyage_client import VoyageClient
from src.openai_client import OpenAIClient
from src.json_storage import JSONStorage
from src.retriever import Retriever
from src.chat_engine import ChatEngine
from src.cli import CLI


def main():
    """Main entry point."""
    # Validate configuration
    missing = Config.validate()
    if missing:
        print("Error: Missing required environment variables:")
        for key in missing:
            print(f"  - {key}")
        print("\nPlease set these in your .env file.")
        sys.exit(1)

    # Initialize clients
    print("Initializing VoyageAI client...")
    voyage_client = VoyageClient()

    print("Initializing OpenAI client...")
    openai_client = OpenAIClient()

    # Initialize storage
    print("Initializing JSON storage...")
    storage = JSONStorage()

    # Initialize retriever
    retriever = Retriever(voyage_client)

    # Initialize chat engine
    chat_engine = ChatEngine(
        voyage_client=voyage_client,
        openai_client=openai_client,
        storage=storage,
        retriever=retriever
    )

    # Run CLI
    cli = CLI(chat_engine)
    cli.run()


if __name__ == "__main__":
    main()
