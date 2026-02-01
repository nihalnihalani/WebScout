"""Configuration for Social Media Tracker."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv(Path(__file__).parent.parent / ".env")

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
COMPANIES_FILE = BASE_DIR.parent / "data" / "companies.json"
SOCIAL_DATA_FILE = DATA_DIR / "social_engagement.json"
SOCIAL_REPORT_FILE = DATA_DIR / "social_report.md"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Settings
MAX_COMPANIES = 10  # Process 10 companies
MAX_CONCURRENT_AGENTS = 3  # Parallel agent limit
MODEL_NAME = "gpt-4o"

# Scraping Settings
ENABLE_PROFILE_SCRAPE = True  # Scrape Twitter/LinkedIn profiles
ENABLE_VALUATION_LOOKUP = True  # Lookup funding data
