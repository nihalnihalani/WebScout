"""Convert raw text files to structured JSON using LLM."""

import json
import sys
from pathlib import Path
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

from .config import Config
from .prompts import CHUNKING_PROMPT, TEST_QUERY_PROMPT


class TextConverter:
    """Convert raw text to structured JSON with chunks and test queries."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize text converter.

        Args:
            api_key: OpenAI API key. Uses Config if not provided.
            model: Model to use. Defaults to Config.CONVERTER_MODEL (gpt-4o-mini).
        """
        self.api_key = api_key or Config.OPENAI_API_KEY
        self.model = model or Config.CONVERTER_MODEL

        self.llm = ChatOpenAI(
            api_key=self.api_key,
            model=self.model,
            temperature=0
        )
        self.parser = StrOutputParser()

    def convert(
        self,
        text: str,
        chunk_size: int = 500,
        num_queries: int = 5
    ) -> dict:
        """Convert raw text to structured JSON.

        Args:
            text: Raw text content.
            chunk_size: Target chunk size in characters.
            num_queries: Number of test queries to generate.

        Returns:
            Dict with 'documents' and 'test_queries' keys.
        """
        # Step 1: Chunk the document
        chunks = self._chunk_document(text, chunk_size)

        # Step 2: Generate test queries
        test_queries = self._generate_test_queries(chunks, num_queries)

        # Build final structure
        documents = [
            {"id": f"chunk_{i}", "content": chunk}
            for i, chunk in enumerate(chunks)
        ]

        return {
            "documents": documents,
            "test_queries": test_queries
        }

    def convert_file(
        self,
        input_path: str,
        output_path: str,
        chunk_size: int = 500,
        num_queries: int = 5
    ) -> dict:
        """Convert a text file to JSON file.

        Args:
            input_path: Path to input .txt file.
            output_path: Path to output .json file.
            chunk_size: Target chunk size in characters.
            num_queries: Number of test queries to generate.

        Returns:
            The converted data dict.
        """
        # Read input file
        with open(input_path, "r", encoding="utf-8") as f:
            text = f.read()

        # Convert
        data = self.convert(text, chunk_size, num_queries)

        # Write output file
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return data

    def _chunk_document(self, text: str, chunk_size: int) -> list[str]:
        """Use LLM to intelligently chunk document."""
        chain = CHUNKING_PROMPT | self.llm | self.parser

        result = chain.invoke({
            "document": text,
            "chunk_size": chunk_size
        })

        # Parse JSON output
        try:
            chunks = json.loads(result)
            if isinstance(chunks, list):
                return chunks
        except json.JSONDecodeError:
            pass

        # Fallback: simple paragraph split
        return [p.strip() for p in text.split("\n\n") if p.strip()]

    def _generate_test_queries(
        self,
        chunks: list[str],
        num_queries: int
    ) -> list[dict]:
        """Generate test queries for the chunks."""
        # Format chunks with IDs for the prompt
        chunks_with_ids = [
            {"id": f"chunk_{i}", "content": chunk}
            for i, chunk in enumerate(chunks)
        ]

        chain = TEST_QUERY_PROMPT | self.llm | self.parser

        result = chain.invoke({
            "chunks_json": json.dumps(chunks_with_ids, indent=2),
            "num_queries": num_queries
        })

        # Parse JSON output
        try:
            queries = json.loads(result)
            if isinstance(queries, list):
                return queries
        except json.JSONDecodeError:
            pass

        # Fallback: empty list
        return []


def main():
    """CLI entry point for text conversion."""
    if len(sys.argv) < 3:
        print("Usage: python -m src.text_converter <input.txt> <output.json> [chunk_size] [num_queries]")
        print("\nArguments:")
        print("  input.txt    - Raw text file to convert")
        print("  output.json  - Output JSON file")
        print("  chunk_size   - Target chunk size (default: 500)")
        print("  num_queries  - Number of test queries (default: 5)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    chunk_size = int(sys.argv[3]) if len(sys.argv) > 3 else 500
    num_queries = int(sys.argv[4]) if len(sys.argv) > 4 else 5

    # Validate API key
    if not Config.OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set in environment")
        sys.exit(1)

    print(f"Converting {input_path} -> {output_path}")
    print(f"Settings: chunk_size={chunk_size}, num_queries={num_queries}")
    print(f"Using model: {Config.CONVERTER_MODEL}")

    converter = TextConverter()
    data = converter.convert_file(input_path, output_path, chunk_size, num_queries)

    print(f"\nDone! Created {len(data['documents'])} chunks and {len(data['test_queries'])} test queries.")


if __name__ == "__main__":
    main()
