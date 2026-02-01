#!/usr/bin/env python3
"""
Social Media Tracker - Main Entry Point

Orchestrates the LangGraph multi-agent workflow to find
social media profiles for YC Winter 2025 companies.

Usage:
    python main.py              # Run tracker (default 5 companies)
    python main.py --all        # Run for all companies
    python main.py --count 10   # Run for specific number
    python main.py --report     # Generate markdown report from existing data
"""

import argparse
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

import config
from graph import run_tracker
from graph_parallel import run_parallel_tracker
from report_generator import generate_social_report


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Social Media Tracker")
    parser.add_argument("--all", action="store_true", help="Process all companies")
    parser.add_argument("--count", type=int, help="Number of companies to process")
    parser.add_argument("--parallel", action="store_true", help="Use parallel processing (faster)")
    parser.add_argument("--report", action="store_true", help="Generate report only")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("   YC Winter 2025 Social Media Tracker")
    print("=" * 60)

    try:
        if args.report:
            # Generate report from existing data
            generate_social_report()
        else:
            # Update config based on args
            if args.all:
                config.MAX_COMPANIES = None
            elif args.count:
                config.MAX_COMPANIES = args.count

            # Run the tracker (parallel or sequential)
            if args.parallel:
                print("Mode: PARALLEL")
                run_parallel_tracker()
            else:
                print("Mode: Sequential")
                run_tracker()

            # Auto-generate report
            print("\n--- Generating Report ---")
            generate_social_report()

        return 0

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
