"""Prompt template for generating test queries from documents."""

from langchain_core.prompts import PromptTemplate

TEST_QUERY_PROMPT = PromptTemplate.from_template(
    """You are a QA test generator. Given the following document chunks, generate test queries that should retrieve specific chunks.

Document chunks:
---
{chunks_json}
---

For each chunk, generate 1-2 questions that would naturally retrieve that chunk. The questions should:
- Be natural language queries a user might ask
- Have clear answers found in the specific chunk
- Vary in style (some direct, some conversational)

Output as JSON array with this format:
[
  {{"query": "question text", "expected_ids": ["chunk_0"]}},
  {{"query": "another question", "expected_ids": ["chunk_1", "chunk_2"]}}
]

Generate {num_queries} test queries total.
Only output valid JSON, no explanation.

JSON output:"""
)
