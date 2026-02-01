"""
Social Report Generator - Stock-Like Dashboard

Transforms social_engagement.json into a human-readable markdown report
with sentiment analysis displayed as a stock analysis dashboard.
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter

import sys
sys.path.insert(0, str(Path(__file__).parent))

from config import SOCIAL_DATA_FILE, SOCIAL_REPORT_FILE


def score_to_bar(score: int, width: int = 10) -> str:
    """Convert a 0-100 score to a visual bar."""
    filled = int(score / 100 * width)
    empty = width - filled
    return "█" * filled + "░" * empty


def rating_to_emoji(rating: str) -> str:
    """Convert rating to emoji indicator."""
    mapping = {
        "STRONG BUY": "🟢",
        "BUY": "🟢",
        "NEUTRAL": "🟡",
        "SELL": "🔴",
        "STRONG SELL": "🔴",
    }
    return mapping.get(rating, "⚪")


def generate_social_report():
    """Generate markdown report from social engagement data."""
    print("\n[Generating Social Media Report]")

    if not SOCIAL_DATA_FILE.exists():
        print(f"  ✗ No data found: {SOCIAL_DATA_FILE}")
        return

    with open(SOCIAL_DATA_FILE, "r") as f:
        data = json.load(f)

    companies = data.get("companies", {})
    timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")

    # Stats
    total = len(companies)
    if total == 0:
        print("  ✗ No companies in data")
        return

    twitter_found = sum(1 for c in companies.values() if c.get("twitter", {}).get("found"))
    linkedin_found = sum(1 for c in companies.values() if c.get("linkedin", {}).get("found"))

    # Sentiment stats
    sentiments = [c.get("sentiment", {}) for c in companies.values() if c.get("sentiment")]
    avg_score = sum(s.get("overall_score", 50) for s in sentiments) / len(sentiments) if sentiments else 50

    rating_counts = Counter(s.get("rating", "NEUTRAL") for s in sentiments)

    # Build report header
    report = f"""# 📈 YC Winter 2025 Sentiment Analysis Report

> **Generated:** {timestamp}
> **Total Companies:** {total}
> **Average Sentiment Score:** {avg_score:.0f}/100

---

## 📊 Portfolio Summary

| Metric | Value |
|--------|-------|
| Companies Analyzed | {total} |
| Twitter Profiles Found | {twitter_found} ({twitter_found/total*100:.0f}%) |
| LinkedIn Profiles Found | {linkedin_found} ({linkedin_found/total*100:.0f}%) |
| Average Sentiment | {avg_score:.0f}/100 |

### Sentiment Distribution

| Rating | Count |
|--------|-------|
| 🟢 STRONG BUY | {rating_counts.get('STRONG BUY', 0)} |
| 🟢 BUY | {rating_counts.get('BUY', 0)} |
| 🟡 NEUTRAL | {rating_counts.get('NEUTRAL', 0)} |
| 🔴 SELL | {rating_counts.get('SELL', 0)} |
| 🔴 STRONG SELL | {rating_counts.get('STRONG SELL', 0)} |

---

## 🏆 Top Rated Companies

"""

    # Sort by sentiment score
    sorted_companies = sorted(
        companies.items(),
        key=lambda x: x[1].get("sentiment", {}).get("overall_score", 0),
        reverse=True
    )

    # Top 5 table
    report += "| Rank | Company | Sector | Score | Rating |\n"
    report += "|------|---------|--------|-------|--------|\n"
    for i, (cid, company) in enumerate(sorted_companies[:5], 1):
        name = company.get("company_name", cid)
        industries = company.get("industries", [])
        sector = industries[0] if industries else "N/A"
        sentiment = company.get("sentiment", {})
        score = sentiment.get("overall_score", 50)
        rating = sentiment.get("rating", "NEUTRAL")
        emoji = rating_to_emoji(rating)
        report += f"| {i} | {name} | {sector} | {score} | {emoji} {rating} |\n"

    report += "\n---\n\n## 🏢 Company Analysis Cards\n\n"

    # Detailed company cards
    for company_id, company in sorted_companies:
        name = company.get("company_name", company_id)
        description = company.get("description", "No description")
        industries = company.get("industries", [])
        location = company.get("location", "Unknown")
        yc_url = company.get("yc_url", "#")

        twitter = company.get("twitter", {})
        linkedin = company.get("linkedin", {})
        valuation = company.get("valuation", {})
        sentiment = company.get("sentiment", {})

        # Sentiment values
        overall_score = sentiment.get("overall_score", 50)
        rating = sentiment.get("rating", "NEUTRAL")
        emoji = rating_to_emoji(rating)

        social_presence = sentiment.get("social_presence", 50)
        product_clarity = sentiment.get("product_clarity", 50)
        market_timing = sentiment.get("market_timing", 50)
        funding_score = sentiment.get("funding_stage", 50)
        competitive_moat = sentiment.get("competitive_moat", 50)
        momentum = sentiment.get("momentum", 50)
        analysis = sentiment.get("analysis", "")
        confidence = sentiment.get("confidence", "medium")

        # Valuation info
        funding_stage = valuation.get("funding_stage", "Seed")
        est_valuation = valuation.get("estimated_valuation", "Unknown")
        investors = valuation.get("investors", ["Y Combinator"])

        # Social info
        twitter_status = twitter.get("handle", "Not found") if twitter.get("found") else "Not found"
        linkedin_status = "Found" if linkedin.get("found") else "Not found"

        card = f"""### {emoji} {name}

**{description}**

| | |
|---|---|
| **Sector** | {', '.join(industries) if industries else 'N/A'} |
| **Location** | {location} |
| **YC Profile** | [View]({yc_url}) |

---

#### 📈 Sentiment Score: {overall_score}/100 ({rating})

```
Social Presence:  {score_to_bar(social_presence)} {social_presence}%
Product Clarity:  {score_to_bar(product_clarity)} {product_clarity}%
Market Timing:    {score_to_bar(market_timing)} {market_timing}%
Funding Stage:    {score_to_bar(funding_score)} {funding_score}%
Competitive Moat: {score_to_bar(competitive_moat)} {competitive_moat}%
Momentum:         {score_to_bar(momentum)} {momentum}%
```

**Analysis:** {analysis}
**Confidence:** {confidence.title()}

---

#### 💰 Valuation

| Metric | Value |
|--------|-------|
| Stage | {funding_stage} |
| Est. Valuation | {est_valuation} |
| Investors | {', '.join(investors)} |

---

#### 📱 Social Presence

| Platform | Status |
|----------|--------|
| Twitter/X | {twitter_status} |
| LinkedIn | {linkedin_status} |

---

"""
        report += card

    # Save report
    with open(SOCIAL_REPORT_FILE, "w") as f:
        f.write(report)

    print(f"  ✓ Report saved to {SOCIAL_REPORT_FILE.name}")
    print(f"  ✓ {total} companies analyzed")
    print(f"  ✓ Average sentiment: {avg_score:.0f}/100")


if __name__ == "__main__":
    generate_social_report()
