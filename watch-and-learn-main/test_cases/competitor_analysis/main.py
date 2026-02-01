#!/usr/bin/env python3
"""
Competitor Analysis Pipeline

Orchestrates the crawling and parsing of YC Winter 2025 companies.

Usage:
    python main.py           # Run full pipeline (crawl + parse)
    python main.py --crawl   # Only crawl
    python main.py --parse   # Only parse (use existing raw data)
"""

import argparse
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.firecrawl_client import YCCrawler
from src.langchain_parser import CompanyParser
from src.markdown_generator import MarkdownReportGenerator


def run_crawl():
    """Run the Firecrawl crawler."""
    print("\n" + "=" * 60)
    print("PHASE 1A: Crawling YC Winter 2025 Companies")
    print("=" * 60)

    crawler = YCCrawler()
    result = crawler.crawl_winter_2025()
    crawler.save_raw_output(result)

    return True


def run_parse():
    """Run the LangChain parser."""
    print("\n" + "=" * 60)
    print("PHASE 1B: Parsing with GPT-4o")
    print("=" * 60)

    parser = CompanyParser()
    markdown = parser.load_raw_data()
    companies = parser.parse_companies(markdown)
    parser.save_companies(companies)

    return companies


def run_report():
    """Generate markdown report from companies.json."""
    print("\n" + "=" * 60)
    print("PHASE 1C: Generating Markdown Report")
    print("=" * 60)

    generator = MarkdownReportGenerator()
    generator.load_companies()
    report = generator.generate_report()
    generator.save_report(report)

    return generator.companies


def main():
    """Main entry point."""
    arg_parser = argparse.ArgumentParser(description="YC Competitor Analysis Pipeline")
    arg_parser.add_argument("--crawl", action="store_true", help="Only run crawler")
    arg_parser.add_argument("--parse", action="store_true", help="Only run parser")
    arg_parser.add_argument("--report", action="store_true", help="Only generate markdown report")
    args = arg_parser.parse_args()

    print("\n" + "=" * 60)
    print("   YC Winter 2025 Competitor Analysis Pipeline")
    print("=" * 60)

    try:
        if args.crawl:
            run_crawl()
        elif args.parse:
            run_parse()
        elif args.report:
            run_report()
        else:
            # Full pipeline
            run_crawl()
            companies = run_parse()

            # Summary
            print("\n" + "=" * 60)
            print("PIPELINE COMPLETE")
            print("=" * 60)
            print(f"\n✓ Extracted {len(companies)} YC Winter 2025 companies")
            print("✓ Data saved to: data/companies.json")

            # Preview
            print("\n--- Top 5 Companies ---")
            for i, (slug, co) in enumerate(companies.items()):
                if i >= 5:
                    break
                loc = co.get('location') or 'N/A'
                print(f"  {i+1}. {co['name']} ({loc})")
                print(f"     {co['description']}")

        return 0

    except Exception as e:
        print(f"\n✗ Pipeline failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
