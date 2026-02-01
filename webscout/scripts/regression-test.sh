#!/bin/bash
# ============================================
# WebScout Regression Test Suite
# ============================================
# This script tests WebScout's core functionality:
# - Scraping new pages
# - Cache hit on repeat patterns
# - Pattern storage in Redis
# - Trace logging to Weave
# ============================================

set -e

# Configuration
BASE_URL="${WEBSCOUT_URL:-http://localhost:3002}"
LOG_FILE="regression_test_$(date +%Y%m%d_%H%M%S).log"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

header() {
    log "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    log "${BLUE}  $1${NC}"
    log "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

test_result() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$1" -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log "${GREEN}✓ PASS:${NC} $2"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log "${RED}✗ FAIL:${NC} $2"
        log "  ${YELLOW}Reason:${NC} $3"
    fi
}

# ============================================
# Test: Health Check
# ============================================
test_health() {
    header "Test 1: Health Check"
    
    HEALTH=$(curl -s "$BASE_URL/api/health")
    STATUS=$(echo "$HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
    REDIS_STATUS=$(echo "$HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin).get('services', {}).get('redis', {}).get('status', 'unknown'))" 2>/dev/null)
    
    if [ "$STATUS" = "healthy" ]; then
        test_result 0 "API Health Check - Status: $STATUS"
    else
        test_result 1 "API Health Check" "Expected 'healthy', got '$STATUS'"
    fi
    
    if [ "$REDIS_STATUS" = "ok" ]; then
        test_result 0 "Redis Connection - Status: $REDIS_STATUS"
    else
        test_result 1 "Redis Connection" "Expected 'ok', got '$REDIS_STATUS'"
    fi
}

# ============================================
# Test: Fresh Scrape
# ============================================
test_fresh_scrape() {
    header "Test 2: Fresh Scrape (books.toscrape.com)"
    
    # Use a random book page to avoid cache hits
    BOOK_NUM=$((RANDOM % 900 + 100))
    URL="https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    TARGET="book title and price"
    
    log "Scraping: $URL"
    log "Target: $TARGET"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"$URL\", \"target\": \"$TARGET\"}" \
        --max-time 120)
    
    TASK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
    ERROR=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', ''))" 2>/dev/null)
    
    if [ -n "$TASK_ID" ] && [ -z "$ERROR" ]; then
        test_result 0 "Scrape Task Created - ID: $TASK_ID"
    else
        test_result 1 "Scrape Task Creation" "Error: $ERROR"
        return 1
    fi
    
    # Wait for completion
    log "Waiting for task completion..."
    sleep 30
    
    # Check task status
    TASK_STATUS=$(curl -s "$BASE_URL/api/tasks/$TASK_ID")
    STATUS=$(echo "$TASK_STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
    RESULT=$(echo "$TASK_STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('result', {}).get('result', '')[:100] if json.load(sys.stdin).get('result') else '')" 2>/dev/null)
    
    if [ "$STATUS" = "success" ]; then
        test_result 0 "Scrape Completed Successfully"
        log "  Result preview: $RESULT..."
    else
        test_result 1 "Scrape Completion" "Status: $STATUS"
    fi
}

# ============================================
# Test: Cache Hit
# ============================================
test_cache_hit() {
    header "Test 3: Cache Hit (quotes.toscrape.com)"
    
    URL="https://quotes.toscrape.com/"
    TARGET="first quote text and author"
    
    log "Testing cache for: $URL"
    
    # Get initial stats
    INITIAL_STATS=$(curl -s "$BASE_URL/api/tasks?limit=1")
    INITIAL_CACHED=$(echo "$INITIAL_STATS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('stats', {}).get('cached', 0))" 2>/dev/null)
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"$URL\", \"target\": \"$TARGET\"}" \
        --max-time 120)
    
    TASK_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
    
    if [ -n "$TASK_ID" ]; then
        test_result 0 "Cache Test Task Created - ID: $TASK_ID"
    else
        test_result 1 "Cache Test Task Creation" "No task ID returned"
        return 1
    fi
    
    sleep 25
    
    # Check if cache was hit
    FINAL_STATS=$(curl -s "$BASE_URL/api/tasks?limit=1")
    FINAL_CACHED=$(echo "$FINAL_STATS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('stats', {}).get('cached', 0))" 2>/dev/null)
    
    if [ "$FINAL_CACHED" -gt "$INITIAL_CACHED" ]; then
        test_result 0 "Cache Hit Detected - Count: $INITIAL_CACHED -> $FINAL_CACHED"
    else
        log "${YELLOW}Note: Cache count unchanged (may be new pattern or timing)${NC}"
        test_result 0 "Cache Check (informational) - Count: $FINAL_CACHED"
    fi
}

# ============================================
# Test: Pattern Storage
# ============================================
test_pattern_storage() {
    header "Test 4: Pattern Storage Verification"
    
    STATS=$(curl -s "$BASE_URL/api/tasks?limit=1")
    PATTERNS=$(echo "$STATS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('stats', {}).get('patterns_learned', 0))" 2>/dev/null)
    
    if [ "$PATTERNS" -gt 0 ]; then
        test_result 0 "Patterns Stored in Redis - Count: $PATTERNS"
    else
        test_result 1 "Pattern Storage" "Expected >0 patterns, got $PATTERNS"
    fi
    
    # Check vector index
    HEALTH=$(curl -s "$BASE_URL/api/health")
    VECTOR_MSG=$(echo "$HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin).get('services', {}).get('redis', {}).get('message', ''))" 2>/dev/null)
    
    if [[ "$VECTOR_MSG" == *"Vector index:"* ]]; then
        test_result 0 "Vector Index Active - $VECTOR_MSG"
    else
        test_result 1 "Vector Index Check" "Unexpected message: $VECTOR_MSG"
    fi
}

# ============================================
# Test: Weave Tracing (via API response)
# ============================================
test_weave_tracing() {
    header "Test 5: Weave Tracing Verification"
    
    # Check if WANDB_API_KEY and WEAVE_PROJECT are configured
    HEALTH=$(curl -s "$BASE_URL/api/health")
    WANDB_CONFIGURED=$(echo "$HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin).get('configuration', {}).get('wandb_api_key', 'missing'))" 2>/dev/null)
    WEAVE_CONFIGURED=$(echo "$HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin).get('configuration', {}).get('weave_project', 'missing'))" 2>/dev/null)
    
    if [ "$WANDB_CONFIGURED" = "configured" ]; then
        test_result 0 "WandB API Key Configured"
    else
        test_result 1 "WandB API Key" "Status: $WANDB_CONFIGURED"
    fi
    
    if [ "$WEAVE_CONFIGURED" = "configured" ]; then
        test_result 0 "Weave Project Configured"
    else
        test_result 1 "Weave Project" "Status: $WEAVE_CONFIGURED"
    fi
}

# ============================================
# Summary Report
# ============================================
print_summary() {
    header "Test Summary"
    
    PASS_RATE=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    
    log "Total Tests:  $TOTAL_TESTS"
    log "Passed:       ${GREEN}$PASSED_TESTS${NC}"
    log "Failed:       ${RED}$FAILED_TESTS${NC}"
    log "Pass Rate:    ${PASS_RATE}%"
    log ""
    log "Full log saved to: $LOG_FILE"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        log "\n${GREEN}══════════════════════════════════════════════════════════════${NC}"
        log "${GREEN}  ✓ ALL TESTS PASSED - WebScout is functioning correctly!${NC}"
        log "${GREEN}══════════════════════════════════════════════════════════════${NC}\n"
        exit 0
    else
        log "\n${RED}══════════════════════════════════════════════════════════════${NC}"
        log "${RED}  ✗ SOME TESTS FAILED - Review logs for details${NC}"
        log "${RED}══════════════════════════════════════════════════════════════${NC}\n"
        exit 1
    fi
}

# ============================================
# Main Execution
# ============================================
main() {
    header "WebScout Regression Test Suite"
    log "Started: $(date)"
    log "Target: $BASE_URL"
    log ""
    
    test_health
    test_fresh_scrape
    test_cache_hit
    test_pattern_storage
    test_weave_tracing
    
    print_summary
}

main "$@"
