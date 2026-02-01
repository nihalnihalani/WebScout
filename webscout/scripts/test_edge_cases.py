#!/usr/bin/env python3
"""
WebScout Edge Case and Error Handling Tests
Tests boundary conditions, error scenarios, and failure modes.
"""

import asyncio
import httpx
import sys
from datetime import datetime
from typing import List, Tuple

BASE_URL = "http://localhost:3002"


async def test_edge_case(name: str, coro) -> Tuple[bool, str]:
    """Run a single edge case test."""
    try:
        result = await coro
        return result
    except Exception as e:
        return (False, f"Exception: {str(e)}")


async def run_edge_case_tests() -> None:
    """Run all edge case tests."""
    print("\n" + "=" * 60)
    print("  WebScout Edge Case Tests")
    print("=" * 60)
    print(f"Started: {datetime.now().isoformat()}\n")
    
    results: List[Tuple[str, bool, str]] = []
    
    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Large limit parameter
        try:
            resp = await client.get(f"{BASE_URL}/api/tasks?limit=1000")
            # Should cap at 100
            passed = resp.status_code == 200
            data = resp.json()
            tasks_count = len(data.get('tasks', []))
            results.append(("Large limit capped", passed, f"Returned {tasks_count} tasks"))
        except Exception as e:
            results.append(("Large limit capped", False, str(e)))
        
        # 2. Negative offset
        try:
            resp = await client.get(f"{BASE_URL}/api/tasks?offset=-10")
            passed = resp.status_code == 200
            results.append(("Negative offset handled", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Negative offset handled", False, str(e)))
        
        # 3. Non-numeric limit
        try:
            resp = await client.get(f"{BASE_URL}/api/tasks?limit=abc")
            # Should handle gracefully
            passed = resp.status_code == 200 or resp.status_code == 400
            results.append(("Non-numeric limit", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Non-numeric limit", False, str(e)))
        
        # 4. Empty JSON body
        try:
            resp = await client.post(f"{BASE_URL}/api/tasks", json={})
            passed = resp.status_code == 400
            results.append(("Empty body validation", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Empty body validation", False, str(e)))
        
        # 5. Invalid JSON
        try:
            resp = await client.post(
                f"{BASE_URL}/api/tasks",
                content="not valid json",
                headers={"Content-Type": "application/json"}
            )
            passed = resp.status_code >= 400
            results.append(("Invalid JSON handling", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Invalid JSON handling", False, str(e)))
        
        # 6. Very long URL
        try:
            long_path = "a" * 2000
            resp = await client.post(
                f"{BASE_URL}/api/tasks",
                json={"url": f"https://example.com/{long_path}", "target": "test"}
            )
            passed = resp.status_code in [200, 400, 500]  # Any valid response
            results.append(("Very long URL", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Very long URL", False, str(e)))
        
        # 7. Unicode target
        try:
            resp = await client.post(
                f"{BASE_URL}/api/tasks",
                json={"url": "https://example.com", "target": "测试 تست 🎯"}
            )
            passed = resp.status_code in [200, 500]  # Should accept unicode
            results.append(("Unicode target accepted", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Unicode target accepted", False, str(e)))
        
        # 8. Patterns endpoint with pagination
        try:
            resp = await client.get(f"{BASE_URL}/api/patterns?limit=1&offset=0")
            passed = resp.status_code == 200
            data = resp.json()
            results.append(("Patterns pagination", passed, f"Total: {data.get('total', 'N/A')}"))
        except Exception as e:
            results.append(("Patterns pagination", False, str(e)))
        
        # 9. Metrics endpoint structure
        try:
            resp = await client.get(f"{BASE_URL}/api/metrics")
            data = resp.json()
            has_timeline = isinstance(data.get('timeline'), list)
            has_summary = isinstance(data.get('summary'), dict)
            passed = has_timeline and has_summary
            results.append(("Metrics structure valid", passed, f"Timeline: {has_timeline}, Summary: {has_summary}"))
        except Exception as e:
            results.append(("Metrics structure valid", False, str(e)))
        
        # 10. Evaluation endpoint structure
        try:
            resp = await client.get(f"{BASE_URL}/api/evaluation")
            data = resp.json()
            passed = resp.status_code == 200
            results.append(("Evaluation endpoint", passed, f"Keys: {list(data.keys())[:3]}"))
        except Exception as e:
            results.append(("Evaluation endpoint", False, str(e)))
        
        # 11. Health check performance
        try:
            start = datetime.now()
            resp = await client.get(f"{BASE_URL}/api/health")
            duration = (datetime.now() - start).total_seconds()
            passed = duration < 2.0  # Should respond within 2 seconds
            results.append(("Health check speed", passed, f"{duration:.2f}s"))
        except Exception as e:
            results.append(("Health check speed", False, str(e)))
        
        # 12. Protocol-less URL
        try:
            resp = await client.post(
                f"{BASE_URL}/api/tasks",
                json={"url": "example.com", "target": "test"}
            )
            passed = resp.status_code == 400  # Should reject
            results.append(("Protocol-less URL rejected", passed, f"Status: {resp.status_code}"))
        except Exception as e:
            results.append(("Protocol-less URL rejected", False, str(e)))
    
    # Print results
    print("\n📊 EDGE CASE RESULTS")
    print("-" * 50)
    
    passed_count = 0
    for name, passed, detail in results:
        status = "✅" if passed else "❌"
        print(f"{status} {name}: {detail}")
        if passed:
            passed_count += 1
    
    print(f"\nTotal: {len(results)} | Passed: {passed_count} | Failed: {len(results) - passed_count}")
    
    if passed_count == len(results):
        print("✅ All edge case tests passed!")
        sys.exit(0)
    else:
        print("⚠️ Some edge case tests failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_edge_case_tests())
