#!/bin/bash
# Deploy SEO MCP SaaS to Fly.io
# Usage: ./scripts/deploy.sh

set -euo pipefail

export PATH="/Users/saura/.fly/bin:$PATH"

echo "🦀 SEO MCP SaaS — Fly.io Deploy"
echo "================================"

# 1. Ensure we have the linux binary
BINARY="./seo-mcp-server"
if [ ! -f "$BINARY" ]; then
  echo "❌ Missing linux binary. Cross-compile first:"
  echo "   cd ~/clawd/projects/seo-mcp && cargo zigbuild --release --target x86_64-unknown-linux-gnu"
  echo "   cp target/x86_64-unknown-linux-gnu/release/seo-mcp-server ~/clawd/projects/seo-mcp-saas/"
  exit 1
fi

file "$BINARY" | grep -q "ELF 64-bit" || {
  echo "❌ Binary is not linux-amd64 ELF. Cross-compile again."
  exit 1
}

echo "✅ Linux binary found ($(du -h $BINARY | cut -f1))"

# 2. Check Fly.io auth
flyctl auth whoami > /dev/null 2>&1 || {
  echo "❌ Not logged in. Run: flyctl auth login"
  exit 1
}
echo "✅ Fly.io authenticated"

# 3. Create app if it doesn't exist
if ! flyctl apps list | grep -q "seo-mcp-saas"; then
  echo "📦 Creating Fly.io app..."
  flyctl apps create seo-mcp-saas --org personal
fi
echo "✅ App exists"

# 4. Create volume for SQLite data (if not exists)
if ! flyctl volumes list -a seo-mcp-saas 2>/dev/null | grep -q "seo_mcp_data"; then
  echo "📦 Creating persistent volume..."
  flyctl volumes create seo_mcp_data --size 1 --region iad -a seo-mcp-saas -y
fi
echo "✅ Volume ready"

# 5. Set secrets (if not already set)
echo "🔐 Checking secrets..."
EXISTING_SECRETS=$(flyctl secrets list -a seo-mcp-saas 2>/dev/null | awk '{print $1}' || true)

if ! echo "$EXISTING_SECRETS" | grep -q "JWT_SECRET"; then
  JWT=$(openssl rand -hex 32)
  TOKEN_KEY=$(openssl rand -hex 32)
  echo "Setting JWT_SECRET and TOKEN_ENCRYPTION_KEY..."
  flyctl secrets set \
    JWT_SECRET="$JWT" \
    TOKEN_ENCRYPTION_KEY="$TOKEN_KEY" \
    -a seo-mcp-saas
fi
echo "✅ Secrets configured"

# 6. Deploy!
echo ""
echo "🚀 Deploying..."
flyctl deploy --ha=false

echo ""
echo "✅ Deployed! Check: https://seo-mcp-saas.fly.dev/health"
echo ""
echo "Next steps:"
echo "  1. Add custom domain: flyctl certs create api.seomcp.dev -a seo-mcp-saas"
echo "  2. Add DNS CNAME: api.seomcp.dev → seo-mcp-saas.fly.dev"
echo "  3. Smoke test: curl https://api.seomcp.dev/health"
