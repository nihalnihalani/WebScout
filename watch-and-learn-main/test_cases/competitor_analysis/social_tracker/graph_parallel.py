"""
LangGraph PARALLEL Multi-Agent Social Media Tracker

Uses Send() API to process multiple companies in parallel:
1. Load companies
2. Fan-out: Send each company to parallel processing
3. Each company runs through: social → valuation → sentiment
4. Fan-in: Aggregate all results
"""

import json
import operator
from typing import TypedDict, Annotated, List
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.constants import Send
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


# ============================================================
# State Definition
# ============================================================

class TrackerState(TypedDict):
    """Main state for the tracker."""
    companies: List[dict]
    results: Annotated[List[dict], operator.add]
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
# Helper Functions
# ============================================================

def find_social_for_company(company: dict) -> dict:
    """Find social profiles for a company."""
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""Find social media profiles. Respond in JSON:
{"twitter_handle": "@handle or null", "linkedin_url": "url or null"}"""),
        HumanMessage(content=f"Company: {company['name']}\nDescription: {company.get('description', 'N/A')}")
    ])

    try:
        response = llm.invoke(prompt.format_messages())
        content = response.content
        if "```" in content:
            content = content.split("```")[1].split("```")[0].replace("json", "")
        data = json.loads(content.strip())
        return {
            "twitter": {"handle": data.get("twitter_handle"), "found": bool(data.get("twitter_handle"))},
            "linkedin": {"url": data.get("linkedin_url"), "found": bool(data.get("linkedin_url"))},
        }
    except:
        return {"twitter": {"found": False}, "linkedin": {"found": False}}


def lookup_valuation_for_company(company: dict) -> dict:
    """Estimate valuation for a company."""
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""Estimate YC W25 company funding. Respond in JSON:
{"funding_stage": "Seed", "estimated_valuation": "$XM-$XM", "investors": ["Y Combinator"]}"""),
        HumanMessage(content=f"Company: {company['name']}\nIndustries: {', '.join(company.get('industries', []))}")
    ])

    try:
        response = llm.invoke(prompt.format_messages())
        content = response.content
        if "```" in content:
            content = content.split("```")[1].split("```")[0].replace("json", "")
        return json.loads(content.strip())
    except:
        return {"funding_stage": "Seed", "investors": ["Y Combinator"]}


def generate_sentiment_for_company(company: dict, social: dict, valuation: dict) -> dict:
    """Generate sentiment score for a company."""
    has_twitter = social.get("twitter", {}).get("found", False)
    has_linkedin = social.get("linkedin", {}).get("found", False)

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content="""Score startup sentiment 0-100. Respond in JSON:
{"overall_score": 50, "rating": "NEUTRAL/BUY/SELL", "analysis": "brief analysis"}"""),
        HumanMessage(content=f"""Company: {company['name']}
Description: {company.get('description', 'N/A')}
Social: Twitter={'Yes' if has_twitter else 'No'}, LinkedIn={'Yes' if has_linkedin else 'No'}
Funding: {valuation.get('funding_stage', 'Seed')}""")
    ])

    try:
        response = llm.invoke(prompt.format_messages())
        content = response.content
        if "```" in content:
            content = content.split("```")[1].split("```")[0].replace("json", "")
        return json.loads(content.strip())
    except:
        return {"overall_score": 50, "rating": "NEUTRAL", "analysis": "Analysis failed"}


# ============================================================
# Node Functions
# ============================================================

def load_companies(state: TrackerState) -> TrackerState:
    """Load companies from JSON file."""
    print("\n[Loading companies...]")

    with open(COMPANIES_FILE, "r") as f:
        all_companies = json.load(f)

    companies_list = list(all_companies.values())[:MAX_COMPANIES]
    print(f"  → Loaded {len(companies_list)} companies")

    return {"companies": companies_list, "results": [], "status": "loaded"}


def fan_out_companies(state: TrackerState):
    """Fan out to process each company in parallel."""
    print(f"\n[Fan-out: {len(state['companies'])} companies...]")
    return [Send("process_company", {"company": c}) for c in state["companies"]]


def process_company(state: dict) -> dict:
    """Process a single company - all 3 steps."""
    company = state["company"]
    print(f"  → {company['name']}")

    # Step 1: Find social
    social = find_social_for_company(company)

    # Step 2: Lookup valuation
    valuation = lookup_valuation_for_company(company)

    # Step 3: Generate sentiment
    sentiment = generate_sentiment_for_company(company, social, valuation)

    score = sentiment.get("overall_score", 50)
    rating = sentiment.get("rating", "NEUTRAL")
    print(f"    ✓ {company['name']}: {score}/100 ({rating})")

    # Build result
    result = {
        "company_id": company.get("id", company.get("slug", "")),
        "company_name": company["name"],
        "description": company.get("description"),
        "industries": company.get("industries"),
        "location": company.get("location"),
        "yc_url": company.get("yc_url"),
        "twitter": social.get("twitter", {}),
        "linkedin": social.get("linkedin", {}),
        "valuation": valuation,
        "sentiment": sentiment,
        "scraped_at": datetime.now().isoformat(),
    }

    return {"results": [result]}


def aggregate_results(state: TrackerState) -> TrackerState:
    """Aggregate all results and save to file."""
    print("\n[Aggregating results...]")

    results = state["results"]

    output = {
        "generated_at": datetime.now().isoformat(),
        "total_companies": len(results),
        "companies": {r["company_id"]: r for r in results if r},
    }

    with open(SOCIAL_DATA_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"  → Saved {len(results)} company profiles")

    return {**state, "status": "complete"}


# ============================================================
# Graph Construction
# ============================================================

def build_parallel_graph():
    """Build the parallel execution graph."""
    workflow = StateGraph(TrackerState)

    # Add nodes
    workflow.add_node("load", load_companies)
    workflow.add_node("process_company", process_company)
    workflow.add_node("aggregate", aggregate_results)

    # Entry point
    workflow.set_entry_point("load")

    # Fan-out from load to parallel company processing
    workflow.add_conditional_edges("load", fan_out_companies, ["process_company"])

    # Fan-in from company processing to aggregate
    workflow.add_edge("process_company", "aggregate")
    workflow.add_edge("aggregate", END)

    return workflow.compile()


# ============================================================
# Entry Point
# ============================================================

def run_parallel_tracker():
    """Run the parallel social media tracker."""
    print("\n" + "=" * 60)
    print("   LangGraph PARALLEL Sentiment Tracker")
    print("=" * 60)

    import time
    start_time = time.time()

    graph = build_parallel_graph()

    initial_state: TrackerState = {
        "companies": [],
        "results": [],
        "status": "initializing",
    }

    final_state = graph.invoke(initial_state, {"recursion_limit": 200})

    elapsed = time.time() - start_time

    print("\n" + "=" * 60)
    print("   PARALLEL TRACKER COMPLETE")
    print("=" * 60)
    print(f"\n✓ Processed {len(final_state['results'])} companies")
    print(f"✓ Time elapsed: {elapsed:.1f} seconds")
    print(f"✓ Results saved to: {SOCIAL_DATA_FILE.name}")

    return final_state


if __name__ == "__main__":
    run_parallel_tracker()
