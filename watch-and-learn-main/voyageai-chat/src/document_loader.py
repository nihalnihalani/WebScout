"""Document loader for raw text and JSON formats."""

import json
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Document:
    """A document chunk with ID and content."""
    content: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    metadata: dict = field(default_factory=dict)


@dataclass
class TestQuery:
    """A test query with expected document IDs."""
    query: str
    expected_ids: list[str]


@dataclass
class DocumentSet:
    """Collection of documents and optional test queries."""
    documents: list[Document]
    test_queries: list[TestQuery] = field(default_factory=list)


class DocumentLoader:
    """Load documents from raw text or JSON files."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        """Initialize document loader.

        Args:
            chunk_size: Target size for text chunks (in characters).
            chunk_overlap: Overlap between chunks (in characters).
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def load(self, file_path: str) -> DocumentSet:
        """Load documents from file (auto-detects format).

        Args:
            file_path: Path to .txt or .json file.

        Returns:
            DocumentSet with documents and optional test queries.
        """
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if path.suffix.lower() == ".json":
            return self._load_json(path)
        elif path.suffix.lower() == ".txt":
            return self._load_text(path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

    def _load_json(self, path: Path) -> DocumentSet:
        """Load pre-structured JSON file.

        Expected format:
        {
            "documents": [{"id": "...", "content": "..."}],
            "test_queries": [{"query": "...", "expected_ids": [...]}]
        }
        """
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        documents = []
        for doc in data.get("documents", []):
            documents.append(Document(
                id=doc.get("id", str(uuid.uuid4())),
                content=doc.get("content", ""),
                metadata=doc.get("metadata", {})
            ))

        test_queries = []
        for tq in data.get("test_queries", []):
            test_queries.append(TestQuery(
                query=tq.get("query", ""),
                expected_ids=tq.get("expected_ids", [])
            ))

        return DocumentSet(documents=documents, test_queries=test_queries)

    def _load_text(self, path: Path) -> DocumentSet:
        """Load raw text file and auto-chunk.

        Chunks by paragraphs first, then by size if needed.
        """
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()

        chunks = self._chunk_text(text)
        documents = [
            Document(id=f"chunk_{i}", content=chunk)
            for i, chunk in enumerate(chunks)
        ]

        return DocumentSet(documents=documents, test_queries=[])

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into chunks.

        Strategy:
        1. Split by double newlines (paragraphs)
        2. If paragraph > chunk_size, split by sentences
        3. Merge small chunks to reach target size
        """
        # Split by paragraphs
        paragraphs = re.split(r'\n\s*\n', text.strip())
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        chunks = []
        current_chunk = ""

        for para in paragraphs:
            # If paragraph itself is too large, split by sentences
            if len(para) > self.chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""

                sentences = self._split_sentences(para)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) > self.chunk_size:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence
                    else:
                        current_chunk += " " + sentence if current_chunk else sentence

            # Normal paragraph - try to merge
            elif len(current_chunk) + len(para) > self.chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        # Simple sentence splitter
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]


def load_documents(file_path: str, chunk_size: int = 500) -> DocumentSet:
    """Convenience function to load documents.

    Args:
        file_path: Path to .txt or .json file.
        chunk_size: Target chunk size for text files.

    Returns:
        DocumentSet with documents and optional test queries.
    """
    loader = DocumentLoader(chunk_size=chunk_size)
    return loader.load(file_path)
