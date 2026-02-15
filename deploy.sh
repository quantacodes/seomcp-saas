#!/bin/bash
# Deploy script for Hetzner production

set -e

echo "🚀 Deploying seo-mcp-saas to production..."

# Configuration
APP_DIR="/opt/seomcp"
DATA_DIR="/var/lib/seomcp"
USER="seomcp"
SERVICE_NAME="seomcp"

# Create user if not exists
if ! id "$USER" &>/dev/null; then
    sudo useradd -r -s /bin/false "$USER"
    echo "✅ Created user: $USER"
fi

# Create directories
sudo mkdir -p "$APP_DIR" "$DATA_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR" "$DATA_DIR"

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# Copy files
echo "📂 Copying files..."
sudo rsync -av --delete backend/ "$APP_DIR/" --exclude=node_modules --exclude=data
sudo rsync -av --delete frontend/dist/ "$APP_DIR/public/"
sudo cp -r proxy/ "$APP_DIR/proxy"

# Install backend dependencies
echo "📥 Installing dependencies..."
cd "$APP_DIR"
sudo -u "$USER" bun install --production

# Set up environment
if [ ! -f "$APP_DIR/.env" ]; then
    echo "⚠️  Creating .env file - PLEASE UPDATE WITH REAL VALUES"
    sudo -u "$USER" tee "$APP_DIR/.env" > /dev/null << 'EOF'
NODE_ENV=production
PORT=3456
HOST=0.0.0.0
DATABASE_PATH=/var/lib/seomcp/data.db
JWT_SECRET=CHANGE_THIS_TO_RANDOM_32_CHARS
TOKEN_ENCRYPTION_KEY=CHANGE_THIS_TO_RANDOM_64_HEX_CHARS
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
SEO_MCP_BINARY=/opt/seomcp/bin/seo-mcp-server
EOF
fi

# Build Rust binary if needed
if [ ! -f "$APP_DIR/bin/seo-mcp-server" ]; then
    echo "🔨 Building Rust binary..."
    cd ../seo-mcp
    cargo build --release
    sudo cp target/release/seo-mcp-server "$APP_DIR/bin/"
    sudo chown "$USER:$USER" "$APP_DIR/bin/seo-mcp-server"
    cd -
fi

# Systemd service
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=SEO MCP SaaS API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/local/bin/bun run src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload and start
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo "✅ Deployed!"
echo ""
echo "Check status: sudo systemctl status $SERVICE_NAME"
echo "View logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "⚠️  IMPORTANT: Update $APP_DIR/.env with real values!"
