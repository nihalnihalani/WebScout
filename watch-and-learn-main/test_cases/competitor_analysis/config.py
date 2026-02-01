"""Configuration for Competitor Analysis project."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
RAW_CRAWL_FILE = DATA_DIR / "raw_crawl.json"
COMPANIES_FILE = DATA_DIR / "companies.json"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Target URL
YC_WINTER_2025_URL = "https://www.ycombinator.com/companies/?batch=Winter%202025"

# Settings
MAX_COMPANIES = None  # None = process all companies
BATCH_SIZE = 15  # Companies per GPT-4o batch (to avoid context limits)
MARKDOWN_REPORT_FILE = DATA_DIR / "companies_report.md"
