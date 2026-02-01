"""Prompt template for intelligent document chunking."""

from langchain_core.prompts import PromptTemplate

CHUNKING_PROMPT = PromptTemplate.from_template(
    """You are a document processing assistant. Your task is to split the following document into meaningful chunks for a retrieval system.

Guidelines:
- Each chunk should be self-contained and make sense on its own
- Keep related information together (don't split mid-paragraph or mid-concept)
- Target chunk size: {chunk_size} characters (can vary based on content)
- Preserve important context in each chunk
- Include any necessary headers or context for understanding

Document to chunk:
---
{document}
---

Output the chunks as a JSON array of strings. Each string is one chunk.
Only output valid JSON, no explanation.

Example output format:
["First chunk content here...", "Second chunk content here...", "Third chunk..."]

JSON output:"""
)
