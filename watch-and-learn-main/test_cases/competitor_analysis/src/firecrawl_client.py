"""Firecrawl API client for crawling YC companies page."""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from firecrawl import V1FirecrawlApp
from config import FIRECRAWL_API_KEY, YC_WINTER_2025_URL, RAW_CRAWL_FILE, DATA_DIR


class YCCrawler:
    """Crawler for Y Combinator company listings."""

    def __init__(self):
        if not FIRECRAWL_API_KEY:
            raise ValueError("FIRECRAWL_API_KEY not found in environment")
        self.app = V1FirecrawlApp(api_key=FIRECRAWL_API_KEY)

    def crawl_winter_2025(self) -> dict:
        """
        Crawl the YC Winter 2025 companies page.

        Returns:
            dict: Raw crawl response from Firecrawl
        """
        print(f"Crawling: {YC_WINTER_2025_URL}")

        # Scrape the page (single page, not full crawl)
        result = self.app.scrape_url(
            YC_WINTER_2025_URL,
            formats=['markdown', 'html']
        )

        print(f"Crawl complete. Response type: {type(result)}")
        return result

    def save_raw_output(self, data) -> Path:
        """
        Save raw crawl output to JSON file.

        Args:
            data: Raw crawl response (V1ScrapeResponse or dict)

        Returns:
            Path: Path to saved file
        """
        # Ensure data directory exists
        DATA_DIR.mkdir(exist_ok=True)

        # Convert Pydantic model to dict if needed
        if hasattr(data, 'model_dump'):
            data_dict = data.model_dump()
        elif hasattr(data, 'dict'):
            data_dict = data.dict()
        else:
            data_dict = data

        # Save to file
        with open(RAW_CRAWL_FILE, 'w', encoding='utf-8') as f:
            json.dump(data_dict, f, indent=2, ensure_ascii=False)

        print(f"Raw output saved to: {RAW_CRAWL_FILE}")
        return RAW_CRAWL_FILE


def main():
    """Run the crawler."""
    print("=" * 50)
    print("YC Winter 2025 Crawler")
    print("=" * 50)

    try:
        crawler = YCCrawler()

        # Crawl the page
        result = crawler.crawl_winter_2025()

        # Save raw output
        output_path = crawler.save_raw_output(result)

        # Show preview
        if isinstance(result, dict):
            print("\n--- Response Keys ---")
            print(list(result.keys()))

            if 'markdown' in result:
                preview = result['markdown'][:500] if result['markdown'] else "No markdown content"
                print("\n--- Markdown Preview (first 500 chars) ---")
                print(preview)

        print(f"\n✓ Success! Raw data saved to: {output_path}")
        return result

    except Exception as e:
        print(f"\n✗ Error: {e}")
        raise


if __name__ == "__main__":
    main()
