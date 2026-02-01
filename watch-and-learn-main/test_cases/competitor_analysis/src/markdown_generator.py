"""
Markdown Report Generator

Transforms companies.json into a human-readable markdown report.
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter
from typing import Dict, Any

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import COMPANIES_FILE, MARKDOWN_REPORT_FILE


class MarkdownReportGenerator:
    """Generates markdown reports from company data."""

    def __init__(self):
        self.companies: Dict[str, Any] = {}

    def load_companies(self) -> Dict[str, Any]:
        """Load companies from JSON file."""
        if not COMPANIES_FILE.exists():
            raise FileNotFoundError(f"Companies file not found: {COMPANIES_FILE}")

        with open(COMPANIES_FILE, "r") as f:
            self.companies = json.load(f)

        print(f"✓ Loaded {len(self.companies)} companies from {COMPANIES_FILE.name}")
        return self.companies

    def _generate_header(self) -> str:
        """Generate report header with metadata."""
        timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        return f"""# YC Winter 2025 Companies Report

> **Generated:** {timestamp}
> **Total Companies:** {len(self.companies)}
> **Source:** [Y Combinator](https://www.ycombinator.com/companies/?batch=Winter%202025)

---

"""

    def _generate_summary_stats(self) -> str:
        """Generate summary statistics section."""
        # Count industries
        industry_counter = Counter()
        for company in self.companies.values():
            for industry in company.get("industries", []):
                industry_counter[industry] += 1

        # Count locations
        location_counter = Counter()
        for company in self.companies.values():
            loc = company.get("location") or "Not Specified"
            location_counter[loc] += 1

        # Build industry stats
        top_industries = industry_counter.most_common(10)
        industry_rows = "\n".join(
            f"| {ind} | {count} |" for ind, count in top_industries
        )

        # Build location stats
        top_locations = location_counter.most_common(5)
        location_rows = "\n".join(
            f"| {loc} | {count} |" for loc, count in top_locations
        )

        return f"""## 📊 Summary Statistics

### Industries Distribution

| Industry | Count |
|----------|-------|
{industry_rows}

### Top Locations

| Location | Count |
|----------|-------|
{location_rows}

---

"""

    def _generate_table_of_contents(self) -> str:
        """Generate table of contents with company links."""
        toc_entries = []
        for i, (slug, company) in enumerate(self.companies.items(), 1):
            name = company.get("name", slug)
            anchor = slug.lower().replace(" ", "-")
            toc_entries.append(f"{i}. [{name}](#{anchor})")

        toc_text = "\n".join(toc_entries)

        return f"""## 📑 Table of Contents

{toc_text}

---

"""

    def _generate_company_entries(self) -> str:
        """Generate detailed entry for each company."""
        entries = []

        for slug, company in self.companies.items():
            name = company.get("name", slug)
            description = company.get("description", "No description available.")
            location = company.get("location") or "Not specified"
            industries = company.get("industries", [])
            yc_url = company.get("yc_url", "#")
            batch = company.get("batch", "Winter 2025")

            industry_badges = " ".join(f"`{ind}`" for ind in industries) if industries else "`N/A`"

            entry = f"""### {name}

**🏷️ Industries:** {industry_badges}
**📍 Location:** {location}
**🎓 Batch:** {batch}

> {description}

🔗 [View on YC]({yc_url})

---

"""
            entries.append(entry)

        return "## 🏢 Company Profiles\n\n" + "".join(entries)

    def generate_report(self) -> str:
        """Generate the full markdown report."""
        if not self.companies:
            self.load_companies()

        report = (
            self._generate_header()
            + self._generate_summary_stats()
            + self._generate_table_of_contents()
            + self._generate_company_entries()
        )

        return report

    def save_report(self, report: str) -> Path:
        """Save the markdown report to file."""
        with open(MARKDOWN_REPORT_FILE, "w") as f:
            f.write(report)

        print(f"✓ Report saved to {MARKDOWN_REPORT_FILE.name}")
        return MARKDOWN_REPORT_FILE


def main():
    """Run the markdown generator standalone."""
    generator = MarkdownReportGenerator()
    generator.load_companies()
    report = generator.generate_report()
    generator.save_report(report)
    print(f"\n✓ Generated report with {len(generator.companies)} companies")


if __name__ == "__main__":
    main()
