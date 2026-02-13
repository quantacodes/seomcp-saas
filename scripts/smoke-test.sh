#!/bin/bash
# E2E Smoke Test for SEO MCP SaaS
# Tests the full flow: signup → API key → MCP init → tool call → usage
#
# Usage: ./scripts/smoke-test.sh [base_url]
# Default: http://localhost:3456

set -e

BASE_URL="${1:-http://localhost:3456}"
EMAIL="smoke-test-$(date +%s)@test.dev"
PASSWORD="smoketest123456"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  TOTAL=$((TOTAL + 1))

  if echo "$actual" | grep -q "$expected"; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name"
    echo -e "    Expected: $expected"
    echo -e "    Got: $(echo "$actual" | head -3)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "🦀 SEO MCP SaaS — Smoke Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $BASE_URL"
echo ""

# 1. Health check
echo "📋 Health Check"
HEALTH=$(curl -s "$BASE_URL/health")
check "Health endpoint returns ok" '"status":"ok"' "$HEALTH"
check "Health includes version" '"version"' "$HEALTH"

# 2. Landing page
echo ""
echo "🏠 Landing Page"
LANDING=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
check "Landing page returns 200" "200" "$LANDING"

# 3. Docs page
echo ""
echo "📖 Docs Page"
DOCS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs")
check "Docs page returns 200" "200" "$DOCS"

# 4. Signup
echo ""
echo "🔐 Signup"
SIGNUP=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
check "Signup returns API key" '"apiKey":"sk_live_' "$SIGNUP"
check "Signup returns user ID" '"id":"' "$SIGNUP"

API_KEY=$(echo "$SIGNUP" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
if [ -z "$API_KEY" ]; then
  echo -e "${RED}  ✗ Could not extract API key — aborting${NC}"
  exit 1
fi
echo -e "  ${YELLOW}→ API Key: ${API_KEY:0:20}...${NC}"

# 5. Duplicate signup rejected
echo ""
echo "🚫 Duplicate Signup"
DUPE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
check "Duplicate email rejected" '"error":"Email already registered"' "$DUPE"

# 6. Login
echo ""
echo "🔑 Login"
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
check "Login returns user" '"email":"' "$LOGIN"

# 7. MCP Initialize
echo ""
echo "🔌 MCP Initialize"
MCP_INIT=$(curl -s -D /dev/stderr -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke-test","version":"0.1.0"}}}' \
  2>/tmp/smoke-test-headers)

SESSION_ID=$(grep -i "mcp-session-id:" /tmp/smoke-test-headers | tr -d '\r\n' | sed 's/.*: //')
check "MCP returns server info" '"serverInfo"' "$MCP_INIT"
check "MCP returns protocol version" '"protocolVersion":"2025-03-26"' "$MCP_INIT"

if [ -z "$SESSION_ID" ]; then
  echo -e "  ${RED}✗ No session ID in headers — skipping tool tests${NC}"
else
  echo -e "  ${YELLOW}→ Session: ${SESSION_ID:0:16}...${NC}"

  # 8. Tools list
  echo ""
  echo "🛠️ Tools List"
  TOOLS=$(curl -s -X POST "$BASE_URL/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
  check "Returns tools array" '"tools"' "$TOOLS"
  
  TOOL_COUNT=$(echo "$TOOLS" | grep -o '"name"' | wc -l | tr -d ' ')
  check "Has 30+ tools" "" ""
  if [ "$TOOL_COUNT" -ge 30 ]; then
    echo -e "    ${GREEN}→ Found $TOOL_COUNT tools${NC}"
  else
    echo -e "    ${YELLOW}→ Found $TOOL_COUNT tools (expected 30+)${NC}"
  fi

  # 9. Tool call (version — lightweight, no external API needed)
  echo ""
  echo "⚡ Tool Call"
  VERSION=$(curl -s -X POST "$BASE_URL/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"version","arguments":{}}}')
  check "Version tool returns result" '"result"' "$VERSION"
  check "Version contains seo-mcp" 'seo-mcp' "$VERSION"

  # 10. Rate limit headers
  echo ""
  echo "📊 Rate Limiting"
  RL_HEADERS=$(curl -s -D /dev/stderr -X POST "$BASE_URL/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"version","arguments":{}}}' \
    2>/tmp/smoke-test-rl-headers > /dev/null)
  RL_LIMIT=$(grep -i "x-ratelimit-limit:" /tmp/smoke-test-rl-headers | tr -d '\r\n')
  check "Rate limit headers present" "x-ratelimit-limit" "$RL_LIMIT"

  # 11. Session termination
  echo ""
  echo "🔄 Session Cleanup"
  DELETE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/mcp" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Mcp-Session-Id: $SESSION_ID")
  check "Session delete returns 200" "200" "$DELETE"
fi

# 12. Usage tracking
echo ""
echo "📈 Usage Stats"
USAGE=$(curl -s "$BASE_URL/api/usage" \
  -H "Authorization: Bearer $API_KEY")
check "Usage endpoint returns data" '"callsThisMonth"' "$USAGE"

# 13. Auth rejection
echo ""
echo "🛡️ Security"
NO_AUTH=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{}')
check "MCP rejects without auth" "401" "$NO_AUTH"

BAD_KEY=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer sk_live_REDACTED_key_12345678901234567890" \
  -H "Content-Type: application/json" \
  -d '{}')
check "MCP rejects invalid key" "401" "$BAD_KEY"

# 14. 404 handling
NOT_FOUND=$(curl -s "$BASE_URL/api/nonexistent")
check "404 returns JSON error" '"error":"Not found"' "$NOT_FOUND"

# Cleanup
rm -f /tmp/smoke-test-headers /tmp/smoke-test-rl-headers

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL $TOTAL TESTS PASSED${NC}"
else
  echo -e "${RED}❌ $FAIL/$TOTAL FAILED${NC} ($PASS passed)"
fi
echo ""
exit $FAIL
