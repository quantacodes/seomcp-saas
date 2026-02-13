#!/bin/bash
# Quick MCP client setup for seomcp.dev
# Usage: curl -fsSL https://seomcp.dev/setup | bash
# Or: bash <(curl -fsSL https://seomcp.dev/setup)

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}🦀 SEO MCP Setup — seomcp.dev${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get API key
read -p "Paste your API key (sk_live_...): " API_KEY
echo ""

if [[ ! "$API_KEY" == sk_live_* ]]; then
  echo -e "${RED}✗ Invalid API key format. Get one at https://seomcp.dev${NC}"
  exit 1
fi

# Detect MCP clients
CLAUDE_CONFIG="$HOME/.config/claude/claude_desktop_config.json"
CURSOR_CONFIG="$HOME/.cursor/mcp.json"
WINDSURF_CONFIG="$HOME/.windsurf/mcp.json"
CLINE_CONFIG="$HOME/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"

echo -e "${BLUE}Detected MCP clients:${NC}"

FOUND=0
if [ -f "$CLAUDE_CONFIG" ] || [ -d "$(dirname "$CLAUDE_CONFIG")" ]; then
  echo "  ✓ Claude Desktop"
  FOUND=$((FOUND + 1))
fi
if [ -d "$(dirname "$CURSOR_CONFIG")" ]; then
  echo "  ✓ Cursor"
  FOUND=$((FOUND + 1))
fi
if [ -d "$(dirname "$WINDSURF_CONFIG")" ]; then
  echo "  ✓ Windsurf"
  FOUND=$((FOUND + 1))
fi
if [ -d "$(dirname "$CLINE_CONFIG")" ]; then
  echo "  ✓ Cline (VS Code)"
  FOUND=$((FOUND + 1))
fi

if [ "$FOUND" -eq 0 ]; then
  echo "  (none detected — showing manual config)"
fi
echo ""

# MCP server config block
MCP_CONFIG=$(cat <<EOF
{
  "seomcp": {
    "url": "https://seomcp.dev/mcp",
    "transport": "streamable-http",
    "headers": {
      "Authorization": "Bearer $API_KEY"
    }
  }
}
EOF
)

# Function to add to JSON config
add_to_config() {
  local config_file="$1"
  local client_name="$2"

  if [ -f "$config_file" ]; then
    # Check if already configured
    if grep -q "seomcp" "$config_file" 2>/dev/null; then
      echo -e "  ${YELLOW}⚠ $client_name already has seomcp configured${NC}"
      return
    fi
  fi

  # Create dir if needed
  mkdir -p "$(dirname "$config_file")"

  if [ -f "$config_file" ]; then
    # Config exists — try to merge into mcpServers
    if command -v jq &>/dev/null; then
      local tmp=$(mktemp)
      jq --arg key "$API_KEY" '.mcpServers.seomcp = {
        "url": "https://seomcp.dev/mcp",
        "transport": "streamable-http",
        "headers": { "Authorization": ("Bearer " + $key) }
      }' "$config_file" > "$tmp" && mv "$tmp" "$config_file"
      echo -e "  ${GREEN}✓ Added to $client_name${NC}"
    else
      echo -e "  ${YELLOW}⚠ jq not found — manual edit needed for $client_name${NC}"
      echo -e "    Add to $config_file:"
      echo ""
    fi
  else
    # Create new config
    cat > "$config_file" <<CONF
{
  "mcpServers": $MCP_CONFIG
}
CONF
    echo -e "  ${GREEN}✓ Created $client_name config${NC}"
  fi
}

# Install to detected clients
echo -e "${BLUE}Setting up...${NC}"

if [ -d "$(dirname "$CLAUDE_CONFIG")" ] || [ -f "$CLAUDE_CONFIG" ]; then
  add_to_config "$CLAUDE_CONFIG" "Claude Desktop"
fi
if [ -d "$(dirname "$CURSOR_CONFIG")" ]; then
  add_to_config "$CURSOR_CONFIG" "Cursor"
fi
if [ -d "$(dirname "$WINDSURF_CONFIG")" ]; then
  add_to_config "$WINDSURF_CONFIG" "Windsurf"
fi

echo ""

# Show manual config for other tools
echo -e "${BOLD}📋 Manual setup (any MCP client):${NC}"
echo ""
echo -e "  ${YELLOW}Add to your MCP config:${NC}"
echo ""
echo '  {' 
echo '    "mcpServers": {'
echo '      "seomcp": {'
echo '        "url": "https://seomcp.dev/mcp",'
echo '        "transport": "streamable-http",'
echo '        "headers": {'
echo "          \"Authorization\": \"Bearer $API_KEY\""
echo '        }'
echo '      }'
echo '    }'
echo '  }'
echo ""

# Verify connection
echo -e "${BLUE}Verifying connection...${NC}"
VERIFY=$(curl -s -w "\n%{http_code}" -X POST "https://seomcp.dev/mcp" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"setup-script","version":"1.0.0"}}}' \
  2>/dev/null || echo "000")

HTTP_CODE=$(echo "$VERIFY" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "  ${GREEN}✓ Connected! 35 SEO tools ready.${NC}"
elif [ "$HTTP_CODE" = "401" ]; then
  echo -e "  ${RED}✗ Invalid API key. Check at https://seomcp.dev/dashboard${NC}"
elif [ "$HTTP_CODE" = "000" ]; then
  echo -e "  ${YELLOW}⚠ Could not connect (server may be starting up). Try again in a moment.${NC}"
else
  echo -e "  ${YELLOW}⚠ Unexpected response: HTTP $HTTP_CODE${NC}"
fi

echo ""
echo -e "${BOLD}🎉 Done!${NC} Restart your MCP client and start using SEO tools."
echo -e "   Docs: https://seomcp.dev/docs"
echo -e "   Dashboard: https://seomcp.dev/dashboard"
echo ""
