#!/bin/bash
# Deploy frontend to Cloudflare Pages

set -e

echo "🚀 Deploying frontend to Cloudflare Pages..."

cd frontend

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Installing wrangler..."
    npm install -g wrangler
fi

# Cloudflare account (saurabh@quantacodes.com)
export CLOUDFLARE_ACCOUNT_ID=198474fc7e41e35922ada1f340d7b3dd

# Create production env file
cat > .env.production << EOF
# Production Environment Variables
VITE_API_URL=https://api.seomcp.dev
VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
EOF

echo "📦 Building frontend for production..."
npm ci
npm run build

echo "☁️  Deploying to Cloudflare Pages..."
# Deploy using wrangler
wrangler pages deploy dist --project-name=seomcp --branch=production

echo "✅ Frontend deployed!"
echo ""
echo "🌐 Your site should be live at: https://seomcp.pages.dev"
echo "   (or your custom domain if configured)"
