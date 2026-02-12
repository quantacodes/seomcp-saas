#!/bin/bash
set -euo pipefail

# SEO MCP SaaS — Deploy to Fly.io
# Usage: ./deploy/deploy.sh [--first-run]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SEO_MCP_REPO="$HOME/clawd/projects/seo-mcp"

cd "$PROJECT_DIR"

echo "🦀 SEO MCP SaaS — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Cross-compile seo-mcp binary for linux-amd64 ──
echo ""
echo "📦 Step 1: Cross-compile seo-mcp for linux-amd64..."

if [ -f "$PROJECT_DIR/seo-mcp-server" ]; then
  echo "  ✓ Linux binary already exists. Delete it to rebuild."
else
  echo "  Building linux-amd64 binary via cross..."
  cd "$SEO_MCP_REPO"

  # Requires: cargo install cross
  # cross uses Docker to cross-compile
  if ! command -v cross &> /dev/null; then
    echo "  ⚠️  'cross' not installed. Install with: cargo install cross"
    echo "  Alternatively, build on a Linux machine and copy the binary."
    echo ""
    echo "  Manual steps:"
    echo "    1. On Linux: cd seo-mcp && cargo build --release"
    echo "    2. Copy target/release/seo-mcp-server to $PROJECT_DIR/"
    echo ""
    exit 1
  fi

  cross build --release --target x86_64-unknown-linux-gnu
  cp target/x86_64-unknown-linux-gnu/release/seo-mcp-server "$PROJECT_DIR/seo-mcp-server"
  echo "  ✓ Binary compiled and copied"
  cd "$PROJECT_DIR"
fi

# ── Step 2: Run tests ──
echo ""
echo "🧪 Step 2: Running tests..."
bun test --bail 2>&1 | tail -5
echo "  ✓ Tests passed"

# ── Step 3: Deploy to Fly.io ──
echo ""
echo "🚀 Step 3: Deploying to Fly.io..."

if [ "${1:-}" = "--first-run" ]; then
  echo "  First-time setup..."

  # Create app
  fly apps create seo-mcp-saas --org personal || echo "  App already exists"

  # Create volume for SQLite
  fly volumes create seo_mcp_data --region iad --size 1 --app seo-mcp-saas || echo "  Volume already exists"

  # Set secrets (prompt for values)
  echo ""
  echo "  Set secrets (you'll be prompted for each):"
  echo "  Required: JWT_SECRET, TOKEN_ENCRYPTION_KEY"
  echo "  Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LEMONSQUEEZY_*"
  echo ""

  # Generate random secrets if not provided
  JWT_SECRET=$(openssl rand -hex 32)
  TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)

  fly secrets set \
    JWT_SECRET="$JWT_SECRET" \
    TOKEN_ENCRYPTION_KEY="$TOKEN_ENCRYPTION_KEY" \
    --app seo-mcp-saas

  echo "  ✓ Secrets set (save these somewhere safe!):"
  echo "    JWT_SECRET=$JWT_SECRET"
  echo "    TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
fi

# Deploy with Fly.io config
fly deploy \
  --config "$SCRIPT_DIR/fly.toml" \
  --dockerfile "$PROJECT_DIR/Dockerfile" \
  --app seo-mcp-saas

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployed!"
echo ""
echo "Next steps:"
echo "  1. Set custom domain: fly certs add seomcp.dev --app seo-mcp-saas"
echo "  2. Update DNS: CNAME seomcp.dev → seo-mcp-saas.fly.dev"
echo "  3. Set Google OAuth secrets:"
echo "     fly secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx --app seo-mcp-saas"
echo "  4. Set Lemon Squeezy secrets:"
echo "     fly secrets set LEMONSQUEEZY_API_KEY=xxx LEMONSQUEEZY_WEBHOOK_SECRET=xxx --app seo-mcp-saas"
echo "  5. Smoke test: curl https://seomcp.dev/health"
