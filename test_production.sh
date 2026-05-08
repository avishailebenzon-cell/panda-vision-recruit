#!/bin/bash

# PRODUCTION VERIFICATION TEST SUITE
# Tests that all production endpoints and configurations are ready
# Usage: ./test_production.sh [api_url] [admin_email] [admin_password]

set -e

API_URL="${1:-http://localhost:8000}"
ADMIN_EMAIL="${2:-admin@test.com}"
ADMIN_PASSWORD="${3:-TestPassword123!}"

echo "🚀 Starting Production Verification Tests"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Helper function for tests
run_test() {
    local test_name="$1"
    local expected_code="$2"
    local method="$3"
    local endpoint="$4"
    local data="$5"

    test_count=$((test_count + 1))

    echo -n "[$test_count] $test_name... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        echo -e "${RED}Unknown method: $method${NC}"
        fail_count=$((fail_count + 1))
        return
    fi

    # Extract status code from last line
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS ($status_code)${NC}"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗ FAIL (expected $expected_code, got $status_code)${NC}"
        echo "  Response: $body"
        fail_count=$((fail_count + 1))
    fi
}

# ============================================================================
# TEST SUITE
# ============================================================================

echo ""
echo "📋 SECTION 1: Health & Status Checks"
echo "======================================="

run_test "Health check endpoint" "200" "GET" "/health"
run_test "Root endpoint" "200" "GET" "/"

echo ""
echo "🔐 SECTION 2: Authentication"
echo "======================================="

# Register admin user
echo -n "[3] Register admin user... "
register_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"full_name\":\"Test Admin\"}")

status=$(echo "$register_response" | tail -n1)
body=$(echo "$register_response" | sed '$d')

if [ "$status" = "201" ] || [ "$status" = "400" ]; then
    # 400 means user already exists, which is OK
    echo -e "${GREEN}✓ PASS ($status)${NC}"
    pass_count=$((pass_count + 1))
else
    echo -e "${RED}✗ FAIL (expected 201 or 400, got $status)${NC}"
    echo "  Response: $body"
    fail_count=$((fail_count + 1))
fi
test_count=$((test_count + 1))

# Login and get token
echo -n "[4] Login and get access token... "
login_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

status=$(echo "$login_response" | tail -n1)
body=$(echo "$login_response" | sed '$d')

if [ "$status" = "200" ]; then
    echo -e "${GREEN}✓ PASS ($status)${NC}"
    pass_count=$((pass_count + 1))

    # Extract token from response
    TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}⚠ WARNING: Could not extract token from response${NC}"
        TOKEN=""
    else
        echo "  Token: ${TOKEN:0:20}..."
    fi
else
    echo -e "${RED}✗ FAIL (expected 200, got $status)${NC}"
    echo "  Response: $body"
    fail_count=$((fail_count + 1))
    TOKEN=""
fi
test_count=$((test_count + 1))

if [ -n "$TOKEN" ]; then
    echo -n "[5] Get current user (with token)... "
    user_response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/auth/me" \
        -H "Authorization: Bearer $TOKEN")

    status=$(echo "$user_response" | tail -n1)
    body=$(echo "$user_response" | sed '$d')

    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✓ PASS ($status)${NC}"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗ FAIL (expected 200, got $status)${NC}"
        echo "  Response: $body"
        fail_count=$((fail_count + 1))
    fi
    test_count=$((test_count + 1))
fi

echo ""
echo "👥 SECTION 3: Candidate Management"
echo "======================================="

# GET candidates list (no auth required for this endpoint in basic setup)
run_test "List candidates" "200" "GET" "/candidates/"

echo ""
echo "💼 SECTION 4: Job Management"
echo "======================================="

# GET jobs list
run_test "List jobs" "200" "GET" "/jobs/"

echo ""
echo "📊 SECTION 5: System Information"
echo "======================================="

run_test "Get agent system status" "200" "GET" "/agents/status"
run_test "List agent tasks" "200" "GET" "/agents/tasks"

echo ""
echo "=========================================="
echo "📊 TEST RESULTS"
echo "=========================================="
echo "Total Tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"

if [ $fail_count -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ALL TESTS PASSED - Production Ready!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ SOME TESTS FAILED - Review above for details${NC}"
    exit 1
fi
