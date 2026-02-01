"""Data models for Social Media Tracker with Valuation & Sentiment."""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class SocialProfile(BaseModel):
    """Social media profile data."""
    platform: str = Field(description="Platform name (twitter, linkedin)")
    url: Optional[str] = Field(default=None, description="Profile URL")
    handle: Optional[str] = Field(default=None, description="Username/handle")
    followers: Optional[int] = Field(default=None, description="Follower count")
    bio: Optional[str] = Field(default=None, description="Profile bio/description")
    recent_posts: Optional[List[str]] = Field(default=None, description="Recent post snippets")
    employee_count: Optional[int] = Field(default=None, description="Employee count (LinkedIn)")
    found: bool = Field(default=False, description="Whether profile was found")
    error: Optional[str] = Field(default=None, description="Error message if failed")


class ValuationData(BaseModel):
    """Company valuation and funding data."""
    funding_stage: Optional[str] = Field(default=None, description="Seed, Series A, etc.")
    total_raised: Optional[str] = Field(default=None, description="Total funding raised")
    last_round: Optional[str] = Field(default=None, description="Last funding round details")
    estimated_valuation: Optional[str] = Field(default=None, description="Estimated valuation")
    investors: Optional[List[str]] = Field(default=None, description="Known investors")
    source: Optional[str] = Field(default=None, description="Data source")


class SentimentScore(BaseModel):
    """Sentiment analysis scores for a company."""
    overall_score: int = Field(default=50, description="Overall sentiment 0-100")
    rating: str = Field(default="NEUTRAL", description="STRONG BUY, BUY, NEUTRAL, SELL, STRONG SELL")

    # Individual metrics (0-100)
    social_presence: int = Field(default=50, description="Social media presence score")
    product_clarity: int = Field(default=50, description="How clear is the product/value prop")
    market_timing: int = Field(default=50, description="Market timing/opportunity score")
    funding_stage: int = Field(default=50, description="Funding maturity score")
    competitive_moat: int = Field(default=50, description="Competitive advantage score")
    momentum: int = Field(default=50, description="Growth momentum score")

    analysis: Optional[str] = Field(default=None, description="GPT analysis summary")
    confidence: str = Field(default="medium", description="Confidence level: high/medium/low")


class CompanySocialData(BaseModel):
    """Complete data for a company including social, valuation, and sentiment."""
    company_id: str = Field(description="Company slug/ID")
    company_name: str = Field(description="Company display name")
    description: Optional[str] = Field(default=None, description="Company description")
    industries: Optional[List[str]] = Field(default=None, description="Industry tags")
    location: Optional[str] = Field(default=None, description="Company location")
    yc_url: Optional[str] = Field(default=None, description="YC profile URL")

    # Social profiles
    twitter: Optional[SocialProfile] = Field(default=None)
    linkedin: Optional[SocialProfile] = Field(default=None)

    # Valuation data
    valuation: Optional[ValuationData] = Field(default=None)

    # Sentiment analysis
    sentiment: Optional[SentimentScore] = Field(default=None)

    scraped_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class AgentState(BaseModel):
    """State passed between LangGraph nodes."""
    companies: List[dict] = Field(default_factory=list)
    current_company: Optional[dict] = Field(default=None)
    results: List[CompanySocialData] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    status: str = Field(default="pending")
