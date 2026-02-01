#!/bin/bash
# ============================================
# WebScout Long-Running Reliability Test
# ============================================
# Runs regression tests repeatedly over a specified duration
# to verify 100% reliability over time.
# ============================================

set -e

# Configuration
DURATION_MINUTES="${1:-60}"  # Default: 1 hour
INTERVAL_SECONDS="${2:-300}" # Default: 5 minutes between runs
BASE_URL="${WEBSCOUT_URL:-http://localhost:3002}"

# Calculate iterations
ITERATIONS=$(( (DURATION_MINUTES * 60) / INTERVAL_SECONDS ))

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Stats
TOTAL_RUNS=0
SUCCESSFUL_RUNS=0
FAILED_RUNS=0
START_TIME=$(date +%s)
REPORT_FILE="reliability_report_$(date +%Y%m%d_%H%M%S).md"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  WebScout Long-Running Reliability Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Duration:      $DURATION_MINUTES minutes"
echo "Interval:      $INTERVAL_SECONDS seconds"
echo "Iterations:    $ITERATIONS"
echo "Target:        $BASE_URL"
echo "Report:        $REPORT_FILE"
echo ""
echo -e "${YELLOW}Starting tests...${NC}"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# WebScout Reliability Report

| Start Time | Duration | Interval |
|------------|----------|----------|
| $(date) | ${DURATION_MINUTES}min | ${INTERVAL_SECONDS}s |

## Test Results

| Run # | Time | Health | Scrape | Cache | Patterns | Status |
|-------|------|--------|--------|-------|----------|--------|
EOF

run_quick_test() {
    local run_num=$1
    local timestamp=$(date +"%H:%M:%S")
    
    # Health check
    HEALTH=$(curl -s --max-time 10 "$BASE_URL/api/health" 2>/dev/null || echo '{"status":"error"}')
    HEALTH_OK=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('status')=='healthy' else '❌')" 2>/dev/null || echo "❌")
    
    # Quick scrape test
    SCRAPE_RESP=$(curl -s --max-time 10 -X POST "$BASE_URL/api/tasks" \
        -H "Content-Type: application/json" \
        -d '{"url":"https://example.com","target":"main heading"}' 2>/dev/null || echo '{"error":"timeout"}')
    SCRAPE_OK=$(echo "$SCRAPE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('id') else '❌')" 2>/dev/null || echo "❌")
    
    # Get stats
    STATS=$(curl -s --max-time 10 "$BASE_URL/api/tasks?limit=1" 2>/dev/null || echo '{"stats":{}}')
    CACHED=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stats',{}).get('cached',0))" 2>/dev/null || echo "0")
    PATTERNS=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stats',{}).get('patterns_learned',0))" 2>/dev/null || echo "0")
    
    CACHE_OK="✅ ($CACHED)"
    PATTERN_OK="✅ ($PATTERNS)"
    
    # Determine overall status
    if [[ "$HEALTH_OK" == "✅" && "$SCRAPE_OK" == "✅" ]]; then
        STATUS="✅ PASS"
        SUCCESSFUL_RUNS=$((SUCCESSFUL_RUNS + 1))
        echo -e "Run $run_num: ${GREEN}PASS${NC} | Health: $HEALTH_OK | Scrape: $SCRAPE_OK | Cache: $CACHED | Patterns: $PATTERNS"
    else
        STATUS="❌ FAIL"
        FAILED_RUNS=$((FAILED_RUNS + 1))
        echo -e "Run $run_num: ${RED}FAIL${NC} | Health: $HEALTH_OK | Scrape: $SCRAPE_OK"
    fi
    
    TOTAL_RUNS=$((TOTAL_RUNS + 1))
    
    # Append to report
    echo "| $run_num | $timestamp | $HEALTH_OK | $SCRAPE_OK | $CACHE_OK | $PATTERN_OK | $STATUS |" >> "$REPORT_FILE"
}

# Main loop
for i in $(seq 1 $ITERATIONS); do
    run_quick_test $i
    
    if [ $i -lt $ITERATIONS ]; then
        echo "  Next test in $INTERVAL_SECONDS seconds..."
        sleep $INTERVAL_SECONDS
    fi
done

# Calculate final stats
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
RELIABILITY=$(echo "scale=2; $SUCCESSFUL_RUNS * 100 / $TOTAL_RUNS" | bc)

# Append summary to report
cat >> "$REPORT_FILE" << EOF

## Summary

| Metric | Value |
|--------|-------|
| Total Runs | $TOTAL_RUNS |
| Successful | $SUCCESSFUL_RUNS |
| Failed | $FAILED_RUNS |
| **Reliability** | **${RELIABILITY}%** |
| Total Duration | ${ELAPSED}s |

EOF

# Print summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Final Results${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Total Runs:    $TOTAL_RUNS"
echo -e "Successful:    ${GREEN}$SUCCESSFUL_RUNS${NC}"
echo -e "Failed:        ${RED}$FAILED_RUNS${NC}"
echo -e "Reliability:   ${GREEN}${RELIABILITY}%${NC}"
echo ""
echo "Report saved:  $REPORT_FILE"

if [ "$FAILED_RUNS" -eq 0 ]; then
    echo -e "\n${GREEN}✓ 100% RELIABILITY ACHIEVED!${NC}\n"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed - review report for details${NC}\n"
    exit 1
fi
