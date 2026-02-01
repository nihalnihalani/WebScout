"""
LangGraph Multi-Agent Social Media Tracker with Valuation & Sentiment

Enhanced workflow that:
1. Loads companies from companies.json
2. Finds social media profiles
3. Looks up valuation/funding data
4. Generates sentiment analysis scores
5. Aggregates results into a unified report
"""

import json
import operator
from typing import TypedDict, Annotated, List, Optional
from datetime import datetime

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    OPENAI_API_KEY,
    COMPANIES_FILE,
    SOCIAL_DATA_FILE,
    MODEL_NAME,
    MAX_COMPANIES,
)
from models import SocialProfile, ValuationData, SentimentScore, CompanySocialData


# ============================================================
# State Definition
# ============================================================

class TrackerState(TypedDict):
    """State shared across all nodes in the graph."""
    companies: List[dict]
    pending: List[dict]
    current: Optional[dict]
    current_social: Optional[dict]  # Intermediate social data
    current_valuation: Optional[dict]  # Intermediate valuation data
    results: Annotated[List[dict], operator.add]  # Results accumulate
    processed_count: int
    total_count: int
    status: str


# ============================================================
# LLM Setup
# ============================================================

llm = ChatOpenAI(
    model=MODEL_NAME,
    api_key=OPENAI_API_KEY,
    temperature=0.1,
)


# ============================================================
# Node Functions
# ============================================================

def load_companies(state: TrackerState) -> TrackerState:
    """Load companies from JSON file."""
    print("\n[Node: load_companies]")

    with open(COMPANIES_FILE, "r") as f:
        all_companies = json.load(f)

    # Convert to list and limit
    companies_list = list(all_companies.values())[:MAX_COMPANIES]

    print(f"  → Loaded {len(companies_list)} companies (limit: {MAX_COMPANIES})")

    return {
        **state,
        "companies": companies_list,
        "pending": companies_list.copy(),
        "total_count": len(companies_list),
        "processed_count": 0,
        "status": "loaded",
    }


def select_next_company(state: TrackerState) -> TrackerState:
    """Select the next company to process."""
    pending = state["pending"]

    if not pending:
        print("\n[Node: select_next_company] No more companies")
        return {**state, "current": None, "status": "done"}

    current = pending[0]
    remaining = pending[1:]

    print(f"\n[Node: select_next_company] Selected: {current['name']}")

    return {
        **state,
        "current": current,
        "pending": remaining,
        "current_social": None,
        "current_valuation": None,
        "status": "processing",
    }


def find_social_profiles(state: TrackerState) -> TrackerState:
    """Use LLM to find social media profiles for current company."""
    company = state["current"]
    if not company:
        return state

    print(f"\n[Node: find_social_profiles] {company['name']}")

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are a research assistant finding social media profiles.
Given a company name and description, provide the most likely Twitter/X handle and LinkedIn company page URL.

Respond in this exact JSON format:
{
    "twitter_handle": "@handle or null if unknown",
    "twitter_url": "https://twitter.com/handle or null",
    "linkedin_url": "https://linkedin.com/company/slug or null",
    "estimated_followers": "number or null",
    "confidence": "high/medium/low"
}

Only provide handles you are reasonably confident about. Use null if uncertain."""),
        HumanMessage(content=f"""Company: {company['name']}
Description: {company.get('description', 'N/A')}
Industries: {', '.join(company.get('industries', []))}
Location: {company.get('location', 'N/A')}""")
    ])

    try:
        response = llm.invoke(prompt.format_messages())
        content = response.content

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        data = json.loads(content.strip())

        twitter_profile = SocialProfile(
            platform="twitter",
            url=data.get("twitter_url"),
            handle=data.get("twitter_handle"),
            followers=data.get("estimated_followers"),
            found=bool(data.get("twitter_handle")),
        )

        linkedin_profile = SocialProfile(
            platform="linkedin",
            url=data.get("linkedin_url"),
            found=bool(data.get("linkedin_url")),
        )

        print(f"  → Twitter: {twitter_profile.handle or 'Not found'}")
        print(f"  → LinkedIn: {'Found' if linkedin_profile.found else 'Not found'}")

        social_data = {
            "twitter": twitter_profile.model_dump(),
            "linkedin": linkedin_profile.model_dump(),
        }

    except Exception as e:
        print(f"  → Error: {e}")
        social_data = {
            "twitter": SocialProfile(platform="twitter", error=str(e)).model_dump(),
            "linkedin": SocialProfile(platform="linkedin", error=str(e)).model_dump(),
        }

    return {**state, "current_social": social_data}


def lookup_valuation(state: TrackerState) -> TrackerState:
    """Use LLM to estimate valuation and funding data."""
    company = state["current"]
    if not company:
        return state

    print(f"\n[Node: lookup_valuation] {company['name']}")

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are a startup analyst researching company valuations.
Given a YC Winter 2025 company, estimate their funding and valuation based on:
- YC standard deal: $500K for 7% = ~$7M post-money valuation at entry
- Additional YC funds: up to $375K MFN SAFE
- Industry and traction signals

Respond in this exact JSON format:
{
    "funding_stage": "Pre-seed/Seed/Series A",
    "total_raised": "$XXX,XXX estimated",
    "estimated_valuation": "$XM - $XM range",
    "investors": ["Y Combinator", "other known investors"],
    "funding_notes": "Brief explanation"
}

Be conservative with estimates. All W25 companies are at Seed stage minimum."""),
        HumanMessage(content=f"""Company: {company['name']}
Description: {company.get('description', 'N/A')}
Industries: {', '.join(company.get('industries', []))}
YC Batch: Winter 2025""")
    ])

    try:
        response = llm.invoke(prompt.format_messages())
        content = response.content

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        data = json.loads(content.strip())

        valuation = ValuationData(
            funding_stage=data.get("funding_stage", "Seed"),
            total_raised=data.get("total_raised"),
            estimated_valuation=data.get("estimated_valuation"),
            investors=data.get("investors", ["Y Combinator"]),
            source="GPT-4o estimation based on YC W25 batch",
        )

        print(f"  → Stage: {valuation.funding_stage}")
        print(f"  → Est. Valuation: {valuation.estimated_valuation}")

    except Exception as e:
        print(f"  → Error: {e}")
        valuation = ValuationData(
            funding_stage="Seed",
            investors=["Y Combinator"],
            source=f"Default (error: {e})",
        )

    return {**state, "current_valuation": valuation.model_dump()}


def generate_sentiment(state: TrackerState) -> TrackerState:
    """Generate sentiment analysis for the company."""
    company = state["current"]
    social_data = state.get("current_social", {})
    valuation_data = state.get("current_valuation", {})

    if not company:
        return state

    print(f"\n[Node: generate_sentiment] {company['name']}")

    # Build context for sentiment analysis
    twitter = social_data.get("twitter", {})
    linkedin = social_data.get("linkedin", {})
    has_twitter = twitter.get("found", False)
    has_linkedin = linkedin.get("found", False)

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""You are a startup analyst generating sentiment scores.
Score each metric from 0-100 and provide an overall rating.

Scoring Guide:
- social_presence: 0-30 (no presence), 31-60 (some presence), 61-100 (strong presence)
- product_clarity: How clear and compelling is the value proposition
- market_timing: Is this the right time for this product/market
- funding_stage: Higher = more mature funding (Seed=40-60, Series A=70-85)
- competitive_moat: Defensibility and unique positioning
- momentum: Growth signals and traction indicators

Overall Rating based on overall_score:
- 80-100: STRONG BUY
- 65-79: BUY
- 45-64: NEUTRAL
- 30-44: SELL
- 0-29: STRONG SELL

Respond in this exact JSON format:
{
    "overall_score": 50,
    "rating": "NEUTRAL",
    "social_presence": 50,
    "product_clarity": 50,
    "market_timing": 50,
    "funding_stage": 50,
    "competitive_moat": 50,
    "momentum": 50,
    "analysis": "2-3 sentence analysis",
    "confidence": "high/medium/low"
}"""),
        HumanMessage(content=f"""Company: {company['name']}
Description: {company.get('description', 'N/A')}
Industries: {', '.join(company.get('industries', []))}
Location: {company.get('location', 'N/A')}

Social Presence:
- Twitter: {'Found (' + twitter.get('handle', '') + ')' if has_twitter else 'Not found'}
- LinkedIn: {'Found' if has_linkedin else 'Not found'}

Funding:
- Stage: {valuation_data.get('funding_stage', 'Unknown')}
- Estimated Valuation: {valuation_data.get('estimated_valuation', 'Unknown')}
- Investors: {', '.join(valuation_data.get('investors', []))}""")
    ])

    try:
        response = llm.invoke(prompt.format_messages())
        content = response.content

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        data = json.loads(content.strip())

        sentiment = SentimentScore(
            overall_score=data.get("overall_score", 50),
            rating=data.get("rating", "NEUTRAL"),
            social_presence=data.get("social_presence", 50),
            product_clarity=data.get("product_clarity", 50),
            market_timing=data.get("market_timing", 50),
            funding_stage=data.get("funding_stage", 50),
            competitive_moat=data.get("competitive_moat", 50),
            momentum=data.get("momentum", 50),
            analysis=data.get("analysis"),
            confidence=data.get("confidence", "medium"),
        )

        print(f"  → Score: {sentiment.overall_score}/100 ({sentiment.rating})")

    except Exception as e:
        print(f"  → Error: {e}")
        sentiment = SentimentScore(
            overall_score=50,
            rating="NEUTRAL",
            analysis=f"Analysis failed: {e}",
            confidence="low",
        )

    # Build final result
    result = CompanySocialData(
        company_id=company.get("id", company.get("slug", "")),
        company_name=company["name"],
        description=company.get("description"),
        industries=company.get("industries"),
        location=company.get("location"),
        yc_url=company.get("yc_url"),
        twitter=SocialProfile(**social_data.get("twitter", {"platform": "twitter"})),
        linkedin=SocialProfile(**social_data.get("linkedin", {"platform": "linkedin"})),
        valuation=ValuationData(**valuation_data) if valuation_data else None,
        sentiment=sentiment,
    )

    return {
        **state,
        "results": [result.model_dump()],
        "processed_count": state["processed_count"] + 1,
    }


def aggregate_results(state: TrackerState) -> TrackerState:
    """Aggregate all results and save to file."""
    print("\n[Node: aggregate_results]")

    results = state["results"]

    output = {
        "generated_at": datetime.now().isoformat(),
        "total_companies": len(results),
        "companies": {r["company_id"]: r for r in results},
    }

    with open(SOCIAL_DATA_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"  → Saved {len(results)} company profiles to {SOCIAL_DATA_FILE.name}")

    return {**state, "status": "complete"}


# ============================================================
# Routing Functions
# ============================================================

def should_continue(state: TrackerState) -> str:
    """Determine if we should continue processing or finish."""
    if state["pending"]:
        return "continue"
    return "finish"


# ============================================================
# Graph Construction
# ============================================================

def build_graph() -> StateGraph:
    """Build the LangGraph workflow."""

    workflow = StateGraph(TrackerState)

    # Add nodes
    workflow.add_node("load_companies", load_companies)
    workflow.add_node("select_next", select_next_company)
    workflow.add_node("find_social", find_social_profiles)
    workflow.add_node("lookup_valuation", lookup_valuation)
    workflow.add_node("generate_sentiment", generate_sentiment)
    workflow.add_node("aggregate", aggregate_results)

    # Set entry point
    workflow.set_entry_point("load_companies")

    # Add edges - sequential flow per company
    workflow.add_edge("load_companies", "select_next")
    workflow.add_edge("find_social", "lookup_valuation")
    workflow.add_edge("lookup_valuation", "generate_sentiment")
    workflow.add_edge("generate_sentiment", "select_next")

    # Conditional edge: continue or finish
    workflow.add_conditional_edges(
        "select_next",
        should_continue,
        {
            "continue": "find_social",
            "finish": "aggregate",
        }
    )

    workflow.add_edge("aggregate", END)

    return workflow.compile()


# ============================================================
# Entry Point
# ============================================================

def run_tracker():
    """Run the social media tracker workflow."""
    print("\n" + "=" * 60)
    print("   LangGraph Social Media Tracker + Sentiment Analysis")
    print("=" * 60)

    graph = build_graph()

    initial_state: TrackerState = {
        "companies": [],
        "pending": [],
        "current": None,
        "current_social": None,
        "current_valuation": None,
        "results": [],
        "processed_count": 0,
        "total_count": 0,
        "status": "initializing",
    }

    # Increase recursion limit: 10 companies × 4 nodes = 40+ iterations needed
    final_state = graph.invoke(initial_state, {"recursion_limit": 100})

    print("\n" + "=" * 60)
    print("   TRACKER COMPLETE")
    print("=" * 60)
    print(f"\n✓ Processed {final_state['processed_count']} companies")
    print(f"✓ Results saved to: {SOCIAL_DATA_FILE.name}")

    return final_state


if __name__ == "__main__":
    run_tracker()
