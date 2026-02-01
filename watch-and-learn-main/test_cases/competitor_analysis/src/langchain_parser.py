"""LangChain parser to extract structured company data using GPT-4o with batch processing."""

import json
import re
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from config import OPENAI_API_KEY, RAW_CRAWL_FILE, COMPANIES_FILE, MAX_COMPANIES, BATCH_SIZE


class CompanyParser:
    """Parse raw crawl data into structured company information with batch processing."""

    def __init__(self):
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment")

        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            api_key=OPENAI_API_KEY
        )

        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a data extraction specialist. Parse this YC company listing data.

TASK: Extract Winter 2025 (W25) batch companies into a structured JSON format.

RULES:
1. Only extract Winter 2025 companies from the provided text
2. Create a hash table/dictionary with company slug as the key
3. Extract: name, slug, location, description, industries, yc_url
4. Generate slug from company name (lowercase, hyphens for spaces)

OUTPUT FORMAT (JSON only, no explanation):
{{
  "company-slug": {{
    "id": "company-slug",
    "name": "Company Name",
    "slug": "company-slug",
    "location": "City, State, Country" or null,
    "description": "One-line description",
    "industries": ["Industry1", "Industry2"],
    "yc_url": "https://www.ycombinator.com/companies/slug",
    "batch": "Winter 2025"
  }}
}}"""),
            ("human", """Parse the following YC company data and extract ALL Winter 2025 companies found:

{markdown_content}

Return ONLY valid JSON, no markdown code blocks or explanations.""")
        ])

    def load_raw_data(self) -> str:
        """Load raw crawl data from file."""
        if not RAW_CRAWL_FILE.exists():
            raise FileNotFoundError(f"Raw crawl file not found: {RAW_CRAWL_FILE}")

        with open(RAW_CRAWL_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return data.get('markdown', '')

    def _split_into_batches(self, markdown: str) -> list[str]:
        """Split markdown into company batches based on company blocks."""
        # Split by company image pattern which marks each company
        pattern = r'(\[!\[\]\([^)]+\)\]\([^)]+\))'
        parts = re.split(pattern, markdown)

        # Reconstruct company blocks
        company_blocks = []
        current_block = ""

        for i, part in enumerate(parts):
            if part.startswith('[![]('):
                if current_block:
                    company_blocks.append(current_block)
                current_block = part
            else:
                current_block += part

        if current_block:
            company_blocks.append(current_block)

        # Filter to only blocks that contain Winter 2025
        w25_blocks = [b for b in company_blocks if 'Winter 2025' in b]

        # Group into batches
        batches = []
        for i in range(0, len(w25_blocks), BATCH_SIZE):
            batch = w25_blocks[i:i + BATCH_SIZE]
            batches.append('\n\n'.join(batch))

        return batches

    def parse_companies(self, markdown_content: str) -> dict:
        """
        Parse markdown content to extract company data using batch processing.

        Args:
            markdown_content: Raw markdown from Firecrawl

        Returns:
            dict: Hash table of all companies
        """
        batches = self._split_into_batches(markdown_content)
        print(f"Split content into {len(batches)} batches of ~{BATCH_SIZE} companies each")

        all_companies = {}
        chain = self.prompt | self.llm

        for i, batch in enumerate(batches):
            print(f"Processing batch {i + 1}/{len(batches)}...")

            try:
                response = chain.invoke({
                    "markdown_content": batch[:30000]  # Safety limit per batch
                })

                content = response.content

                # Clean up response if it has markdown code blocks
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                if content.endswith("```"):
                    content = content[:-3]

                batch_companies = json.loads(content.strip())
                all_companies.update(batch_companies)
                print(f"  → Extracted {len(batch_companies)} companies from batch {i + 1}")

            except Exception as e:
                print(f"  ⚠ Error in batch {i + 1}: {e}")
                continue

        # Apply MAX_COMPANIES limit if set
        if MAX_COMPANIES and len(all_companies) > MAX_COMPANIES:
            limited = dict(list(all_companies.items())[:MAX_COMPANIES])
            print(f"Limited to {MAX_COMPANIES} companies (from {len(all_companies)})")
            all_companies = limited

        print(f"\nTotal extracted: {len(all_companies)} companies")
        return all_companies

    def save_companies(self, companies: dict) -> Path:
        """Save parsed companies to JSON file."""
        with open(COMPANIES_FILE, 'w', encoding='utf-8') as f:
            json.dump(companies, f, indent=2, ensure_ascii=False)

        print(f"Companies saved to: {COMPANIES_FILE}")
        return COMPANIES_FILE


def main():
    """Run the parser."""
    print("=" * 50)
    print("LangChain Company Parser (GPT-4o + Batch Processing)")
    print("=" * 50)

    try:
        parser = CompanyParser()

        # Load raw data
        print("\nLoading raw crawl data...")
        markdown = parser.load_raw_data()
        print(f"Loaded {len(markdown)} characters")

        # Parse companies
        companies = parser.parse_companies(markdown)

        # Save results
        output_path = parser.save_companies(companies)

        # Preview
        print("\n--- Sample Companies ---")
        for i, (slug, company) in enumerate(companies.items()):
            if i >= 5:
                break
            print(f"  {slug}: {company.get('name')} - {company.get('description', '')[:50]}...")

        print(f"\n✓ Success! {len(companies)} companies saved to: {output_path}")
        return companies

    except Exception as e:
        print(f"\n✗ Error: {e}")
        raise


if __name__ == "__main__":
    main()
