"""Tests for retrieval accuracy and speed."""

from pathlib import Path

import numpy as np
import pytest
from sklearn.metrics.pairwise import cosine_similarity

from src.config import Config
from src.document_loader import load_documents
from src.voyage_client import VoyageClient
from src.retriever import Retriever


# Path to test fixtures
FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE_JSON = FIXTURES_DIR / "sample.json"


class TestDocumentLoader:
    """Test document loading functionality."""

    def test_load_json(self):
        """Test loading JSON format documents."""
        doc_set = load_documents(str(SAMPLE_JSON))

        assert len(doc_set.documents) == 5
        assert len(doc_set.test_queries) == 7
        assert doc_set.documents[0].id == "doc_python"

    def test_document_set_structure(self):
        """Test DocumentSet has correct structure."""
        doc_set = load_documents(str(SAMPLE_JSON))

        for doc in doc_set.documents:
            assert doc.id is not None
            assert doc.content is not None
            assert len(doc.content) > 0

        for query in doc_set.test_queries:
            assert query.query is not None
            assert len(query.expected_ids) > 0


@pytest.fixture(scope="module")
def voyage_client():
    """Create VoyageAI client (shared across tests)."""
    if not Config.VOYAGE_API_KEY:
        pytest.skip("VOYAGE_API_KEY not set")
    return VoyageClient()


@pytest.fixture(scope="module")
def indexed_documents(voyage_client):
    """Load and index sample documents."""
    doc_set = load_documents(str(SAMPLE_JSON))

    # Embed all documents
    contents = [doc.content for doc in doc_set.documents]
    embeddings = voyage_client.embed_documents(contents)

    # Create index: {doc_id: embedding}
    index = {}
    for doc, embedding in zip(doc_set.documents, embeddings):
        index[doc.id] = {
            "content": doc.content,
            "embedding": embedding
        }

    return {
        "doc_set": doc_set,
        "index": index
    }


class TestRetrievalAccuracy:
    """Test retrieval accuracy metrics."""

    def test_precision_at_k(self, voyage_client, indexed_documents):
        """Test precision@k for all test queries."""
        doc_set = indexed_documents["doc_set"]
        index = indexed_documents["index"]

        k_values = [1, 3, 5]
        results = {k: [] for k in k_values}

        for test_query in doc_set.test_queries:
            # Embed query
            query_embedding = voyage_client.embed_query(test_query.query)

            # Get all embeddings
            doc_ids = list(index.keys())
            doc_embeddings = np.array([index[doc_id]["embedding"] for doc_id in doc_ids])

            # Calculate similarities
            query_vec = np.array(query_embedding).reshape(1, -1)
            similarities = cosine_similarity(query_vec, doc_embeddings)[0]

            # Rank by similarity
            ranked_indices = np.argsort(similarities)[::-1]
            ranked_ids = [doc_ids[i] for i in ranked_indices]

            # Calculate precision@k for each k
            expected_set = set(test_query.expected_ids)
            for k in k_values:
                top_k_ids = set(ranked_ids[:k])
                relevant_in_k = len(top_k_ids & expected_set)
                precision = relevant_in_k / k
                results[k].append(precision)

        # Print results
        print("\n=== Retrieval Accuracy Results ===")
        for k in k_values:
            avg_precision = np.mean(results[k])
            print(f"Precision@{k}: {avg_precision:.2%}")

        # Assert minimum performance
        assert np.mean(results[1]) >= 0.5, "Precision@1 too low"

    def test_recall_at_k(self, voyage_client, indexed_documents):
        """Test recall@k for all test queries."""
        doc_set = indexed_documents["doc_set"]
        index = indexed_documents["index"]

        k_values = [1, 3, 5]
        results = {k: [] for k in k_values}

        for test_query in doc_set.test_queries:
            # Embed query
            query_embedding = voyage_client.embed_query(test_query.query)

            # Get all embeddings
            doc_ids = list(index.keys())
            doc_embeddings = np.array([index[doc_id]["embedding"] for doc_id in doc_ids])

            # Calculate similarities
            query_vec = np.array(query_embedding).reshape(1, -1)
            similarities = cosine_similarity(query_vec, doc_embeddings)[0]

            # Rank by similarity
            ranked_indices = np.argsort(similarities)[::-1]
            ranked_ids = [doc_ids[i] for i in ranked_indices]

            # Calculate recall@k
            expected_set = set(test_query.expected_ids)
            for k in k_values:
                top_k_ids = set(ranked_ids[:k])
                relevant_in_k = len(top_k_ids & expected_set)
                recall = relevant_in_k / len(expected_set) if expected_set else 0
                results[k].append(recall)

        # Print results
        print("\n=== Recall Results ===")
        for k in k_values:
            avg_recall = np.mean(results[k])
            print(f"Recall@{k}: {avg_recall:.2%}")

        # Assert minimum performance
        assert np.mean(results[3]) >= 0.5, "Recall@3 too low"


class TestRetrievalSpeed:
    """Test retrieval speed benchmarks."""

    def test_embedding_speed(self, voyage_client, benchmark):
        """Benchmark document embedding speed."""
        test_doc = "This is a test document for measuring embedding speed."

        result = benchmark(voyage_client.embed_documents, [test_doc])

        assert len(result) == 1
        assert len(result[0]) > 0

    def test_query_embedding_speed(self, voyage_client, benchmark):
        """Benchmark query embedding speed."""
        test_query = "What is the embedding speed?"

        result = benchmark(voyage_client.embed_query, test_query)

        assert len(result) > 0

    def test_retrieval_speed(self, voyage_client, indexed_documents, benchmark):
        """Benchmark full retrieval pipeline speed."""
        index = indexed_documents["index"]
        doc_ids = list(index.keys())
        doc_embeddings = np.array([index[doc_id]["embedding"] for doc_id in doc_ids])

        def retrieve(query: str):
            # Embed query
            query_embedding = voyage_client.embed_query(query)

            # Calculate similarities
            query_vec = np.array(query_embedding).reshape(1, -1)
            similarities = cosine_similarity(query_vec, doc_embeddings)[0]

            # Rank
            ranked_indices = np.argsort(similarities)[::-1][:3]
            return [doc_ids[i] for i in ranked_indices]

        result = benchmark(retrieve, "What is Python?")

        assert len(result) == 3

    def test_rerank_speed(self, voyage_client, indexed_documents, benchmark):
        """Benchmark reranking speed."""
        index = indexed_documents["index"]
        documents = [index[doc_id]["content"] for doc_id in list(index.keys())[:3]]
        query = "What programming language focuses on safety?"

        result = benchmark(voyage_client.rerank, query, documents, 2)

        assert len(result) == 2


class TestEndToEnd:
    """End-to-end retrieval tests."""

    def test_full_pipeline(self, voyage_client, indexed_documents):
        """Test complete retrieval pipeline."""
        index = indexed_documents["index"]
        retriever = Retriever(voyage_client)

        # Prepare embeddings in expected format
        embeddings = [
            (doc_id, data["embedding"])
            for doc_id, data in index.items()
        ]

        # Test query
        query = "Which language prevents memory errors?"

        # Retrieve
        similar_ids = retriever.retrieve_similar_ids(query, embeddings, k=3)

        print(f"\nQuery: {query}")
        print(f"Retrieved: {similar_ids}")

        # Expected: doc_rust should be in top results
        assert "doc_rust" in similar_ids, "Expected doc_rust in results"

    def test_pipeline_with_rerank(self, voyage_client, indexed_documents):
        """Test retrieval with reranking."""
        index = indexed_documents["index"]

        # Get embeddings
        doc_ids = list(index.keys())
        doc_embeddings = np.array([index[doc_id]["embedding"] for doc_id in doc_ids])

        query = "How does RAG improve AI responses?"

        # Embed query
        query_embedding = voyage_client.embed_query(query)

        # Initial retrieval
        query_vec = np.array(query_embedding).reshape(1, -1)
        similarities = cosine_similarity(query_vec, doc_embeddings)[0]
        top_indices = np.argsort(similarities)[::-1][:5]
        retrieved_docs = [index[doc_ids[i]]["content"] for i in top_indices]

        # Rerank
        reranked = voyage_client.rerank(query, retrieved_docs, top_k=2)

        print(f"\nQuery: {query}")
        print(f"Top reranked score: {reranked[0]['relevance_score']:.4f}")

        assert len(reranked) == 2
        assert reranked[0]["relevance_score"] >= reranked[1]["relevance_score"]
