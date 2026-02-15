#!/bin/bash
# Test Google auth directly with proper MCP protocol

SA_PATH="${1:-$GOOGLE_SERVICE_ACCOUNT}"

if [ ! -f "$SA_PATH" ]; then
    echo "Usage: ./test-auth.sh /path/to/service-account.json"
    exit 1
fi

echo "=== Testing Google Service Account ==="
echo ""

# Extract client_email
CLIENT_EMAIL=$(cat "$SA_PATH" | jq -r '.client_email')
echo "Client Email: $CLIENT_EMAIL"
echo ""

cd "$(dirname "$0")"

# Create a minimal config
cat > /tmp/test-config.toml << EOF
[credentials]
google_service_account = "$SA_PATH"

[[sites]]
name = "test"
domain = "example.com"
EOF

echo "=== Testing binary with proper MCP protocol ==="
echo ""

# Send initialize followed by tool call
{
  # Initialize
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 0.1
  
  # Initialized notification
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  sleep 0.1
  
  # Tool call
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ga4_list_properties"}}'
  sleep 2
} | SEO_MCP_CONFIG=/tmp/test-config.toml ./seo-mcp-server 2>&1

rm -f /tmp/test-config.toml
