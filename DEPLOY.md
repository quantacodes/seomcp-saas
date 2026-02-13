# Deployment Guide — seomcp.dev

Step-by-step checklist to go from code to live.

---

## Prerequisites

- [ ] Fly.io CLI installed (`curl -L https://fly.io/install.sh | sh`)
- [ ] Fly.io account + logged in (`fly auth login`)
- [ ] Domain `seomcp.dev` purchased
- [ ] Rust cross-compilation toolchain (for linux binary)

---

## Step 1: Cross-compile seo-mcp binary for Linux

The Fly.io container runs on linux-amd64. You need a Linux build of the Rust binary.

```bash
# Option A: Using cross (recommended)
cd ~/clawd/projects/seo-mcp
cargo install cross
cross build --release --target x86_64-unknown-linux-gnu

# Copy to SaaS project root
cp target/x86_64-unknown-linux-gnu/release/seo-mcp-server \
   ~/clawd/projects/seo-mcp-saas/seo-mcp-server

# Option B: Docker build
docker run --rm \
  -v ~/clawd/projects/seo-mcp:/src \
  -w /src \
  rust:1.84-bookworm \
  cargo build --release

cp ~/clawd/projects/seo-mcp/target/release/seo-mcp-server \
   ~/clawd/projects/seo-mcp-saas/seo-mcp-server
```

**Verify the binary is Linux:**
```bash
file ~/clawd/projects/seo-mcp-saas/seo-mcp-server
# Should say: ELF 64-bit LSB executable, x86-64
```

---

## Step 2: Create Fly.io app + volume

```bash
cd ~/clawd/projects/seo-mcp-saas

# Create the app
fly apps create seo-mcp-saas

# Create persistent volume for SQLite
fly volumes create seo_mcp_data --region iad --size 1

# Set secrets (generate fresh for production!)
fly secrets set \
  JWT_SECRET=$(openssl rand -hex 32) \
  TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  ADMIN_SECRET=$(openssl rand -hex 32) \
  TRUSTED_PROXY=true

# These you'll fill in after setting up each service:
# fly secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx
# fly secrets set RESEND_API_KEY=xxx
# fly secrets set LEMONSQUEEZY_API_KEY=xxx LEMONSQUEEZY_STORE_ID=xxx ...
```

---

## Step 3: Google Cloud project (OAuth)

1. Go to https://console.cloud.google.com
2. Create project "seomcp-dev"
3. Enable APIs:
   - Google Search Console API
   - Google Analytics Data API
   - PageSpeed Insights API
4. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized redirect URI: `https://seomcp.dev/api/auth/google/callback`
5. Set secrets:
```bash
fly secrets set \
  GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=xxx \
  GOOGLE_REDIRECT_URI=https://seomcp.dev/api/auth/google/callback
```

**Note:** For production OAuth, you'll need to submit for Google verification (privacy policy page at `/privacy` is already built for this).

---

## Step 4: Resend email setup

1. Sign up at https://resend.com
2. Add + verify domain `seomcp.dev` (add DNS records)
3. Get API key
4. Set secret:
```bash
fly secrets set \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM_EMAIL=verify@seomcp.dev
```

---

## Step 5: Lemon Squeezy billing setup

1. Create store at https://lemonsqueezy.com
2. Create 2 products:
   - **Pro** — $29/mo recurring
   - **Agency** — $79/mo recurring
3. Note the variant IDs from each product
4. Set webhook URL: `https://seomcp.dev/api/billing/webhook`
5. Webhook events to enable:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_resumed`
   - `order_refunded`
6. Set secrets:
```bash
fly secrets set \
  LEMONSQUEEZY_API_KEY=xxx \
  LEMONSQUEEZY_STORE_ID=xxx \
  LEMONSQUEEZY_WEBHOOK_SECRET=xxx \
  LEMONSQUEEZY_PRO_VARIANT_ID=xxx \
  LEMONSQUEEZY_AGENCY_VARIANT_ID=xxx
```

---

## Step 6: Deploy

```bash
cd ~/clawd/projects/seo-mcp-saas

# First deploy
fly deploy --config deploy/fly.toml

# Check it's healthy
fly status
fly logs
```

---

## Step 7: DNS + SSL

```bash
# Add custom domain
fly certs add seomcp.dev
fly certs add www.seomcp.dev

# Get the IP address
fly ips list
```

Add DNS records at your registrar:
- `A` record: `seomcp.dev` → Fly IPv4
- `AAAA` record: `seomcp.dev` → Fly IPv6
- `CNAME` record: `www.seomcp.dev` → `seomcp.dev`

SSL is auto-provisioned by Fly.io.

---

## Step 8: Smoke test

```bash
# Health check
curl https://seomcp.dev/health

# Signup
curl -X POST https://seomcp.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123"}'

# MCP initialize
curl -X POST https://seomcp.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_REDACTED_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}'

# Should return 35 tools
curl -X POST https://seomcp.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_REDACTED_KEY" \
  -H "Mcp-Session-Id: SESSION_ID_FROM_ABOVE" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Or run the full smoke test:
```bash
BASE_URL=https://seomcp.dev bash scripts/smoke-test.sh
```

---

## Step 9: Launch 🚀

See `LAUNCH.md` for:
- X announcement thread (9 tweets)
- Product Hunt listing copy
- Reddit posts (r/SEO, r/artificial)
- Hacker News Show post

---

## Monitoring

```bash
# Live logs
fly logs -a seo-mcp-saas

# Admin stats (set ADMIN_SECRET first)
curl https://seomcp.dev/api/admin/stats \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"

# Scale up if needed
fly scale count 2    # Add a second machine
fly scale vm shared-cpu-4x  # More CPU
```

---

## Backup

SQLite database lives on the Fly volume at `/data/seo-mcp-saas.db`.

```bash
# SSH into the machine
fly ssh console

# Backup database
sqlite3 /data/seo-mcp-saas.db ".backup /data/backup-$(date +%Y%m%d).db"
```

Consider setting up automated backups with Litestream or a cron job.

---

## Rollback

```bash
# List recent deploys
fly releases

# Rollback to previous
fly deploy --image registry.fly.io/seo-mcp-saas:deployment-XXXXX
```
