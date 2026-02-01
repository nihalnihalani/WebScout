"""
WebScout Weave Evaluation Test
Uses Weave's Evaluation framework to test WebScout's scraping capabilities.
Based on the Weave documentation patterns.
"""

import asyncio
import json
import weave
from weave import Model
import httpx


# Initialize Weave
weave.init('alhinai/webscout')


class WebScoutModel(Model):
    """WebScout Model for Weave evaluation."""
    
    api_url: str = "http://localhost:3002"
    timeout: int = 120
    
    @weave.op()
    async def predict(self, url: str, target: str) -> dict:
        """Submit a scraping task and wait for result."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # Submit task
            response = await client.post(
                f"{self.api_url}/api/tasks",
                json={"url": url, "target": target}
            )
            data = response.json()
            
            if "error" in data:
                return {
                    "success": False,
                    "result": None,
                    "error": data.get("error"),
                    "cached": False,
                }
            
            # Handle result - can be string or dict
            result_data = data.get("result", {})
            if isinstance(result_data, str):
                result_text = result_data
                cached = False
            else:
                result_text = result_data.get("result") if isinstance(result_data, dict) else str(result_data)
                cached = result_data.get("used_cached_pattern", False) if isinstance(result_data, dict) else False
            
            return {
                "success": data.get("status") == "success",
                "result": result_text,
                "cached": cached,
                "steps": len(data.get("steps", [])),
            }


@weave.op()
def success_score(output: dict) -> dict:
    """Score whether the scrape was successful."""
    return {"success": output.get("success", False)}


@weave.op()
def has_result_score(output: dict) -> dict:
    """Score whether a result was extracted."""
    result = output.get("result")
    has_result = result is not None and len(str(result)) > 0
    return {"has_result": has_result}


@weave.op()
def cache_score(output: dict) -> dict:
    """Score whether a cached pattern was used."""
    return {"used_cache": output.get("cached", False)}


@weave.op()
def result_quality_score(output: dict, target: str) -> dict:
    """Score the quality of the result based on target keywords."""
    result = str(output.get("result", "")).lower()
    target_words = target.lower().split()
    
    # Check if any target words appear in result
    matches = sum(1 for word in target_words if word in result)
    quality = matches / len(target_words) if target_words else 0
    
    return {"result_quality": quality}


async def run_evaluation():
    """Run the WebScout evaluation."""
    print("\n🔍 WebScout Weave Evaluation")
    print("=" * 60)
    
    # Create model instance
    model = WebScoutModel()
    
    # Define evaluation dataset
    dataset = [
        {
            "url": "https://quotes.toscrape.com/",
            "target": "first quote text and author",
            "expected_contains": ["quote", "author"],
        },
        {
            "url": "https://books.toscrape.com/",
            "target": "first book title and price",
            "expected_contains": ["book", "price"],
        },
        {
            "url": "https://example.com/",
            "target": "main heading text",
            "expected_contains": ["example", "domain"],
        },
    ]
    
    # Create Weave Dataset
    weave_dataset = weave.Dataset(name='webscout_eval', rows=dataset)
    weave.publish(weave_dataset)
    print(f"✅ Published dataset with {len(dataset)} rows")
    
    # Define evaluation
    evaluation = weave.Evaluation(
        name='webscout_scraping_eval',
        dataset=weave_dataset,
        scorers=[
            success_score,
            has_result_score,
            cache_score,
            result_quality_score,
        ],
    )
    
    print("🚀 Starting evaluation...")
    print("   (This may take 1-2 minutes per test case)")
    
    # Run evaluation
    results = await evaluation.evaluate(model)
    
    print("\n📊 Evaluation Results:")
    print("-" * 40)
    print(json.dumps(results, indent=2, default=str))
    
    return results


async def quick_test():
    """Run a quick test of the model."""
    print("\n🧪 Quick Model Test")
    print("=" * 60)
    
    model = WebScoutModel()
    
    # Single test
    result = await model.predict(
        url="https://quotes.toscrape.com/",
        target="first quote"
    )
    
    print(f"Success: {result['success']}")
    print(f"Cached: {result['cached']}")
    print(f"Steps: {result.get('steps', 'N/A')}")
    print(f"Result: {str(result.get('result', ''))[:100]}...")
    
    return result


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        asyncio.run(quick_test())
    else:
        asyncio.run(run_evaluation())
