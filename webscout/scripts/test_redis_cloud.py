#!/usr/bin/env python3
"""
WebScout Redis Cloud Connectivity Test
Tests Redis Cloud connection and verifies RediSearch functionality.
"""

import redis
import json
import sys
from datetime import datetime

# Redis Cloud connection details
REDIS_CONFIG = {
    'host': 'redis-11863.c278.us-east-1-4.ec2.cloud.redislabs.com',
    'port': 11863,
    'decode_responses': True,
    'username': 'default',
    'password': 'tQQSQLKiGNUlBEqlTd4wpR0eyw7aItos',
}

def test_basic_connection():
    """Test basic Redis connection"""
    print("=" * 60)
    print("TEST 1: Basic Connection")
    print("=" * 60)
    
    try:
        r = redis.Redis(**REDIS_CONFIG)
        
        # Test PING
        pong = r.ping()
        print(f"✅ PING: {pong}")
        
        # Test SET/GET
        test_key = f"test:webscout:{datetime.now().timestamp()}"
        r.set(test_key, "connection_test")
        result = r.get(test_key)
        r.delete(test_key)
        print(f"✅ SET/GET: {result}")
        
        # Get server info
        info = r.info()
        print(f"✅ Redis Version: {info.get('redis_version', 'unknown')}")
        print(f"✅ Connected Clients: {info.get('connected_clients', 'unknown')}")
        
        return True, r
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False, None


def test_redisearch_module(r):
    """Test RediSearch module availability"""
    print("\n" + "=" * 60)
    print("TEST 2: RediSearch Module")
    print("=" * 60)
    
    try:
        # List all modules
        modules = r.execute_command('MODULE', 'LIST')
        module_names = [m[1] if len(m) > 1 else str(m) for m in modules]
        print(f"✅ Loaded Modules: {module_names}")
        
        # Check for search module
        has_search = any('search' in str(m).lower() for m in modules)
        if has_search:
            print("✅ RediSearch module is available")
        else:
            print("⚠️ RediSearch module not found")
            
        return has_search
    except Exception as e:
        print(f"❌ Module check failed: {e}")
        return False


def test_vector_index(r):
    """Test vector index operations"""
    print("\n" + "=" * 60)
    print("TEST 3: Vector Index")
    print("=" * 60)
    
    try:
        # List all indices
        indices = r.execute_command('FT._LIST')
        print(f"✅ Existing Indices: {indices}")
        
        # Check for webscout index
        if 'idx:page_patterns' in indices:
            # Get index info
            info = r.execute_command('FT.INFO', 'idx:page_patterns')
            doc_count = None
            for i, item in enumerate(info):
                if item == 'num_docs':
                    doc_count = info[i + 1]
                    break
            print(f"✅ idx:page_patterns exists with {doc_count} documents")
        else:
            print("⚠️ idx:page_patterns not found (will be created on first use)")
            
        return True
    except Exception as e:
        print(f"❌ Vector index check failed: {e}")
        return False


def test_pattern_operations(r):
    """Test pattern storage operations"""
    print("\n" + "=" * 60)
    print("TEST 4: Pattern Operations")
    print("=" * 60)
    
    try:
        # Create a test pattern
        test_pattern_id = f"pattern:test:{datetime.now().timestamp()}"
        test_pattern = {
            'url_pattern': 'test.example.com/*',
            'target': 'test extraction',
            'approach': 'extract',
            'working_selector': 'div.content',
            'success_count': 1,
            'created_at': datetime.now().isoformat(),
        }
        
        # Store as JSON string
        r.set(test_pattern_id, json.dumps(test_pattern))
        print(f"✅ Pattern stored: {test_pattern_id}")
        
        # Retrieve and verify
        stored = r.get(test_pattern_id)
        parsed = json.loads(stored)
        print(f"✅ Pattern retrieved: url_pattern={parsed['url_pattern']}")
        
        # Clean up test data
        r.delete(test_pattern_id)
        print("✅ Test pattern cleaned up")
        
        return True
    except Exception as e:
        print(f"❌ Pattern operations failed: {e}")
        return False


def list_existing_data(r):
    """List any existing WebScout data in Redis Cloud"""
    print("\n" + "=" * 60)
    print("TEST 5: Existing Data Check")
    print("=" * 60)
    
    try:
        # Scan for pattern keys
        patterns = list(r.scan_iter(match='pattern:*', count=100))
        print(f"📦 Pattern keys found: {len(patterns)}")
        
        # Scan for task keys
        tasks = list(r.scan_iter(match='task:*', count=100))
        print(f"📦 Task keys found: {len(tasks)}")
        
        # Get total key count
        dbsize = r.dbsize()
        print(f"📦 Total keys in database: {dbsize}")
        
        return True
    except Exception as e:
        print(f"❌ Data check failed: {e}")
        return False


def main():
    print("\n🔴 WebScout Redis Cloud Connectivity Test")
    print("=" * 60)
    print(f"Target: {REDIS_CONFIG['host']}:{REDIS_CONFIG['port']}")
    print(f"Time: {datetime.now().isoformat()}")
    print()
    
    # Run tests
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Basic connection
    success, r = test_basic_connection()
    if success:
        tests_passed += 1
    else:
        tests_failed += 1
        print("\n❌ Cannot proceed without connection")
        sys.exit(1)
    
    # Test 2: RediSearch module
    if test_redisearch_module(r):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Test 3: Vector index
    if test_vector_index(r):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Test 4: Pattern operations
    if test_pattern_operations(r):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Test 5: Existing data
    if list_existing_data(r):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Tests Passed: {tests_passed}")
    print(f"Tests Failed: {tests_failed}")
    
    if tests_failed == 0:
        print("\n✅ All Redis Cloud tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️ Some tests failed - review output above")
        sys.exit(1)


if __name__ == "__main__":
    main()
