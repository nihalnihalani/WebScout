"""CLI interface for the chat application."""

from .chat_engine import ChatEngine


class CLI:
    """Command-line interface for the chat application."""

    def __init__(self, chat_engine: ChatEngine):
        """Initialize CLI.

        Args:
            chat_engine: ChatEngine instance.
        """
        self.engine = chat_engine
        self.running = True

    def run(self) -> None:
        """Run the CLI chat loop."""
        self._print_welcome()

        while self.running:
            try:
                user_input = input("\nYou: ").strip()

                if not user_input:
                    continue

                # Handle commands
                if user_input.startswith("/"):
                    self._handle_command(user_input)
                    continue

                # Process message
                print("\nAssistant: ", end="", flush=True)
                response = self.engine.process_message(user_input)
                print(response)

            except KeyboardInterrupt:
                print("\n\nGoodbye!")
                break
            except Exception as e:
                print(f"\nError: {e}")

    def _handle_command(self, command: str) -> None:
        """Handle CLI commands."""
        cmd = command.lower()

        if cmd in ("/quit", "/exit", "/q"):
            print("Goodbye!")
            self.running = False

        elif cmd == "/help":
            self._print_help()

        elif cmd == "/history":
            self._show_history()

        elif cmd == "/clear":
            self._clear_history()

        else:
            print(f"Unknown command: {command}")
            print("Type /help for available commands.")

    def _print_welcome(self) -> None:
        """Print welcome message."""
        print("=" * 50)
        print("  VoyageAI RAG Chat")
        print("=" * 50)
        print("Type your message or use commands:")
        print("  /help  - Show available commands")
        print("  /quit  - Exit the application")
        print("=" * 50)

    def _print_help(self) -> None:
        """Print help message."""
        print("\nAvailable commands:")
        print("  /help     - Show this help message")
        print("  /quit     - Exit (also /exit, /q)")
        print("  /history  - Show recent chat history")
        print("  /clear    - Clear all chat history")

    def _show_history(self) -> None:
        """Show recent chat history."""
        messages = self.engine.get_history(limit=10)
        if not messages:
            print("\nNo chat history yet.")
            return

        print("\n--- Recent History ---")
        for msg in messages:
            prefix = "You" if msg.role == "user" else "Assistant"
            # Truncate long messages
            content = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            print(f"{prefix}: {content}")
        print("--- End History ---")

    def _clear_history(self) -> None:
        """Clear chat history with confirmation."""
        confirm = input("Clear all chat history? (y/n): ").strip().lower()
        if confirm == "y":
            count = self.engine.clear_history()
            print(f"Cleared {count} messages.")
        else:
            print("Cancelled.")
