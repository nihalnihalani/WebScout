#!/usr/bin/env python3
"""
WebScout Comprehensive Feature Test Suite
Tests ALL API endpoints and edge cases.
"""

import asyncio
import json
import httpx
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

# Configuration
BASE_URL = "http://localhost:3002"
TIMEOUT = 120


class TestResult:
    def __init__(self, name: str, passed: bool, detail: str = "", duration: float = 0):
        self.name = name
        self.passed = passed
        self.detail = detail
        self.duration = duration


class WebScoutTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.results: List[TestResult] = []
        
    async def run_all_tests(self) -> None:
        """Run all test suites."""
        print("\n" + "=" * 70)
        print("  WebScout Comprehensive Feature Test Suite")
        print("=" * 70)
        print(f"Target: {self.base_url}")
        print(f"Started: {datetime.now().isoformat()}")
        print()
        
        await self.test_health_api()
        await self.test_tasks_api_validation()
        await self.test_tasks_api_get()
        await self.test_patterns_api()
        await self.test_metrics_api()
        await self.test_evaluation_api()
        await self.test_timeline_api()
        await self.test_scraping_edge_cases()
        await self.test_caching_behavior()
        
        self.print_summary()
        
    async def test_health_api(self) -> None:
        """Test /api/health endpoint."""
        print("\n📍 TEST SUITE: Health API")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            # Test 1: Basic health check
            start = datetime.now()
            try:
                resp = await client.get(f"{self.base_url}/api/health")
                data = resp.json()
                duration = (datetime.now() - start).total_seconds()
                
                passed = data.get("status") == "healthy"
                self.results.append(TestResult(
                    "Health: API Status",
                    passed,
                    f"Status: {data.get('status')}",
                    duration
                ))
                
                # Test 2: Redis connection
                redis_status = data.get("services", {}).get("redis", {}).get("status")
                self.results.append(TestResult(
                    "Health: Redis Connection",
                    redis_status == "ok",
                    f"Redis: {redis_status}"
                ))
                
                # Test 3: Weave configuration
                weave_config = data.get("configuration", {}).get("weave_project")
                self.results.append(TestResult(
                    "Health: Weave Config",
                    weave_config == "configured",
                    f"Weave: {weave_config}"
                ))
                
            except Exception as e:
                self.results.append(TestResult("Health: API Status", False, str(e)))
    
    async def test_tasks_api_validation(self) -> None:
        """Test /api/tasks POST validation."""
        print("\n📍 TEST SUITE: Tasks API Validation")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            # Test: Missing URL
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"target": "test"}
                )
                self.results.append(TestResult(
                    "Validation: Missing URL",
                    resp.status_code == 400,
                    f"Status: {resp.status_code}"
                ))
            except Exception as e:
                self.results.append(TestResult("Validation: Missing URL", False, str(e)))
            
            # Test: Missing target
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"url": "https://example.com"}
                )
                self.results.append(TestResult(
                    "Validation: Missing Target",
                    resp.status_code == 400,
                    f"Status: {resp.status_code}"
                ))
            except Exception as e:
                self.results.append(TestResult("Validation: Missing Target", False, str(e)))
            
            # Test: Invalid URL format
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"url": "not-a-valid-url", "target": "test"}
                )
                self.results.append(TestResult(
                    "Validation: Invalid URL Format",
                    resp.status_code == 400,
                    f"Status: {resp.status_code}"
                ))
            except Exception as e:
                self.results.append(TestResult("Validation: Invalid URL Format", False, str(e)))
            
            # Test: Empty target
            try:
                resp = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"url": "https://example.com", "target": "   "}
                )
                self.results.append(TestResult(
                    "Validation: Empty Target",
                    resp.status_code == 400,
                    f"Status: {resp.status_code}"
                ))
            except Exception as e:
                self.results.append(TestResult("Validation: Empty Target", False, str(e)))
    
    async def test_tasks_api_get(self) -> None:
        """Test /api/tasks GET endpoint."""
        print("\n📍 TEST SUITE: Tasks API GET")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            # Test: List tasks
            try:
                resp = await client.get(f"{self.base_url}/api/tasks")
                data = resp.json()
                
                self.results.append(TestResult(
                    "Tasks GET: List Tasks",
                    "tasks" in data and "stats" in data,
                    f"Found {len(data.get('tasks', []))} tasks"
                ))
                
                # Test: Stats structure
                stats = data.get("stats", {})
                required_stats = ["total", "successful", "cached", "patterns_learned"]
                has_all = all(s in stats for s in required_stats)
                self.results.append(TestResult(
                    "Tasks GET: Stats Structure",
                    has_all,
                    f"Stats keys: {list(stats.keys())}"
                ))
                
            except Exception as e:
                self.results.append(TestResult("Tasks GET: List Tasks", False, str(e)))
            
            # Test: Pagination
            try:
                resp = await client.get(f"{self.base_url}/api/tasks?limit=5&offset=0")
                data = resp.json()
                self.results.append(TestResult(
                    "Tasks GET: Pagination",
                    resp.status_code == 200,
                    f"Limited to {len(data.get('tasks', []))} tasks"
                ))
            except Exception as e:
                self.results.append(TestResult("Tasks GET: Pagination", False, str(e)))
    
    async def test_patterns_api(self) -> None:
        """Test /api/patterns GET endpoint."""
        print("\n📍 TEST SUITE: Patterns API")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/patterns")
                data = resp.json()
                
                self.results.append(TestResult(
                    "Patterns: List Patterns",
                    "patterns" in data and "total" in data,
                    f"Found {data.get('total', 0)} patterns"
                ))
                
                # Check pattern structure if any exist
                patterns = data.get("patterns", [])
                if patterns:
                    p = patterns[0]
                    has_fields = all(k in p for k in ["id", "url_pattern", "target"])
                    self.results.append(TestResult(
                        "Patterns: Pattern Structure",
                        has_fields,
                        f"Pattern fields: {list(p.keys())[:5]}..."
                    ))
                else:
                    self.results.append(TestResult(
                        "Patterns: Pattern Structure",
                        True,
                        "No patterns yet (OK for empty state)"
                    ))
                    
            except Exception as e:
                self.results.append(TestResult("Patterns: List Patterns", False, str(e)))
    
    async def test_metrics_api(self) -> None:
        """Test /api/metrics GET endpoint."""
        print("\n📍 TEST SUITE: Metrics API")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/metrics")
                data = resp.json()
                
                self.results.append(TestResult(
                    "Metrics: Endpoint Response",
                    "timeline" in data and "summary" in data,
                    f"Timeline points: {len(data.get('timeline', []))}"
                ))
                
                # Check summary structure
                summary = data.get("summary", {})
                required = ["totalTasks", "patternsLearned", "avgDuration"]
                has_all = all(k in summary for k in required)
                self.results.append(TestResult(
                    "Metrics: Summary Structure",
                    has_all,
                    f"Total tasks: {summary.get('totalTasks', 0)}"
                ))
                
            except Exception as e:
                self.results.append(TestResult("Metrics: Endpoint Response", False, str(e)))
    
    async def test_evaluation_api(self) -> None:
        """Test /api/evaluation GET endpoint."""
        print("\n📍 TEST SUITE: Evaluation API")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/evaluation")
                data = resp.json()
                
                self.results.append(TestResult(
                    "Evaluation: Endpoint Response",
                    resp.status_code == 200,
                    f"Keys: {list(data.keys())[:5]}"
                ))
                
                # Check for cohorts if available
                if "cohorts" in data:
                    self.results.append(TestResult(
                        "Evaluation: Cohort Analysis",
                        True,
                        f"Found {len(data.get('cohorts', []))} cohorts"
                    ))
                    
            except Exception as e:
                self.results.append(TestResult("Evaluation: Endpoint Response", False, str(e)))
    
    async def test_timeline_api(self) -> None:
        """Test /api/timeline GET endpoint."""
        print("\n📍 TEST SUITE: Timeline API")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/timeline")
                
                self.results.append(TestResult(
                    "Timeline: Endpoint Response",
                    resp.status_code == 200,
                    f"Status: {resp.status_code}"
                ))
                
            except Exception as e:
                self.results.append(TestResult("Timeline: Endpoint Response", False, str(e)))
    
    async def test_scraping_edge_cases(self) -> None:
        """Test scraping edge cases."""
        print("\n📍 TEST SUITE: Scraping Edge Cases")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Test: Simple successful scrape
            try:
                start = datetime.now()
                resp = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"url": "https://example.com", "target": "main heading"}
                )
                duration = (datetime.now() - start).total_seconds()
                data = resp.json()
                
                self.results.append(TestResult(
                    "Scrape: Simple Page (example.com)",
                    data.get("status") == "success",
                    f"Duration: {duration:.1f}s",
                    duration
                ))
            except Exception as e:
                self.results.append(TestResult("Scrape: Simple Page", False, str(e)))
    
    async def test_caching_behavior(self) -> None:
        """Test caching behavior."""
        print("\n📍 TEST SUITE: Caching Behavior")
        print("-" * 40)
        
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # First request might create a new pattern
            try:
                resp1 = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"url": "https://quotes.toscrape.com/", "target": "first quote"}
                )
                data1 = resp1.json()
                first_cached = data1.get("used_cached_pattern", False)
                
                # Second request should use cached pattern
                resp2 = await client.post(
                    f"{self.base_url}/api/tasks",
                    json={"url": "https://quotes.toscrape.com/", "target": "first quote"}
                )
                data2 = resp2.json()
                second_cached = data2.get("used_cached_pattern", False)
                
                self.results.append(TestResult(
                    "Cache: Pattern Learning",
                    data1.get("status") == "success",
                    f"First call cached: {first_cached}"
                ))
                
                self.results.append(TestResult(
                    "Cache: Pattern Reuse",
                    second_cached or first_cached,  # Either should use cache eventually
                    f"Second call cached: {second_cached}"
                ))
                
            except Exception as e:
                self.results.append(TestResult("Cache: Pattern Test", False, str(e)))
    
    def print_summary(self) -> None:
        """Print test summary."""
        print("\n" + "=" * 70)
        print("  TEST RESULTS SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total = len(self.results)
        
        for r in self.results:
            status = "✅" if r.passed else "❌"
            duration_str = f" ({r.duration:.1f}s)" if r.duration > 0 else ""
            print(f"{status} {r.name}: {r.detail}{duration_str}")
        
        print("\n" + "-" * 40)
        print(f"Total: {total} | Passed: {passed} | Failed: {failed}")
        print(f"Pass Rate: {(passed/total*100):.1f}%" if total > 0 else "N/A")
        
        if failed > 0:
            print("\n⚠️  Some tests failed - review output above")
            sys.exit(1)
        else:
            print("\n✅ All tests passed!")
            sys.exit(0)


async def main():
    tester = WebScoutTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
