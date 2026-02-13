# seomcp.dev

**35 SEO tools for any AI agent. One MCP endpoint. Your real Google data.**

Give Claude, Cursor, Windsurf, or any MCP-compatible AI agent full SEO capabilities — Google Search Console, GA4 Analytics, site audits, schema validation, IndexNow submissions, and more.

## Architecture

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐
│  User's AI Agent │ ◄──────────────────► │  SEO MCP Gateway  │
│  (Claude, Cursor, │   (Streamable HTTP)  │  (Bun/Hono)       │
│   Windsurf, etc) │                       └────────┬─────────┘
└─────────────────┘                                 │
                                                    ▼
                                          ┌──────────────────┐
                                          │  seo-mcp engine   │
                                          │  (Rust binary)    │
                                          └────────┬─────────┘
                                                    │
                              ┌──────────┬──────────┼──────────┐
                              ▼          ▼          ▼          ▼
                           Google     Google     PageSpeed   IndexNow
                           Search     Analytics  Insights    API
                           Console    (GA4)      API
```

The gateway wraps the [seo-mcp](https://github.com/quantacodes/seo-mcp) Rust binary via stdio JSON-RPC. Each user gets an isolated binary process with their own Google credentials.

## Stack

- **Runtime:** Bun + Hono HTTP framework
- **MCP Transport:** Streamable HTTP (POST /mcp with JSON-RPC)
- **Database:** SQLite via Drizzle ORM
- **Auth:** API keys (SHA-256 hashed), session cookies for dashboard
- **Billing:** Lemon Squeezy (checkout overlay, webhooks)
- **Google OAuth:** AES-256-GCM encrypted token storage
- **Binary Management:** Process pool with 5-min idle timeout

## Quick Start

```bash
# Install deps
bun install

# Copy env and configure
cp .env.example .env
# Edit .env with your secrets

# Run dev server
bun run src/index.ts
```

Server starts at http://localhost:3456

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | — | Health check |
| `/mcp` | POST | API key | MCP Streamable HTTP (JSON-RPC) |
| `/api/auth/signup` | POST | — | Create account |
| `/api/auth/login` | POST | — | Login (get API key) |
| `/api/keys` | GET/POST | API key | Manage API keys |
| `/api/usage` | GET | API key | Usage stats |
| `/api/auth/google/start` | GET | Session | Start Google OAuth |
| `/api/auth/google/callback` | GET | — | OAuth callback |
| `/dashboard` | GET | Session | Web dashboard |
| `/docs` | GET | — | API documentation |

## Pricing

| Plan | Price | Calls/mo | Sites |
|------|-------|----------|-------|
| Free | $0 | 50 | 1 |
| Pro | $29/mo | 2,000 | 5 |
| Agency | $79/mo | 10,000 | Unlimited |

## MCP Client Config

```json
{
  "mcpServers": {
    "seo": {
      "url": "https://seomcp.dev/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer sk_live_REDACTED_api_key"
      }
    }
  }
}
```

## Tools (35)

**Crawl:** site_audit, crawl_page, test_robots_txt
**GSC:** gsc_performance, gsc_list_sites, gsc_list_sitemaps, gsc_submit_sitemap, gsc_delete_sitemap, gsc_inspect_url, gsc_bulk_inspect, gsc_search_appearances
**GA4:** ga4_report, ga4_realtime, ga4_metadata, ga4_overview, ga4_top_pages, ga4_traffic_sources, ga4_devices, ga4_geography
**CWV:** core_web_vitals
**Schema:** validate_schema, analyze_robots_txt
**Sitemaps:** sitemap_index_diff
**IndexNow:** indexnow_submit_url, indexnow_batch_submit, indexnow_submit_sitemap, indexnow_submit_file
**Reports:** generate_report
**Meta:** version

## Docker

```bash
# Build (requires linux-amd64 seo-mcp binary in project root)
docker build -t seo-mcp-saas .

# Run
docker compose up -d
```

## Tests

```bash
bun run test       # 319+ tests (serial, isolated DBs)
bun test --watch   # Watch mode
```

## Project Structure

```
src/
├── index.ts              # Hono app + middleware
├── config.ts             # Environment config + plan limits
├── types.ts              # Shared TypeScript types
├── auth/
│   ├── google.ts         # Google OAuth (consent, exchange, refresh, revoke)
│   ├── keys.ts           # API key generation (sk_live_* format)
│   ├── middleware.ts      # Bearer token auth middleware
│   ├── scopes.ts         # API key tool category scoping
│   ├── session.ts        # Dashboard session management
│   └── verification.ts   # Email verification (HMAC tokens, Resend API)
├── billing/
│   ├── lemonsqueezy.ts   # Lemon Squeezy API client
│   └── webhooks.ts       # Webhook verification + event processing
├── config/
│   └── user-config.ts    # Per-user config.toml generation
├── crypto/
│   └── tokens.ts         # AES-256-GCM encrypt/decrypt
├── db/
│   ├── index.ts          # SQLite connection (WAL mode)
│   ├── migrate.ts        # Schema migrations (31 statements)
│   └── schema.ts         # Drizzle ORM schema (10 tables)
├── mcp/
│   ├── binary.ts         # Rust binary process pool
│   ├── session.ts        # MCP session manager
│   └── transport.ts      # MCP Streamable HTTP transport
├── ratelimit/
│   └── middleware.ts      # Monthly rate limit enforcement
├── routes/
│   ├── auth.ts           # Signup/login endpoints
│   ├── billing.ts        # Billing API (checkout, webhooks, portal)
│   ├── dashboard.ts      # Dashboard pages + API
│   ├── docs.ts           # Documentation page
│   ├── google-auth.ts    # Google OAuth endpoints
│   ├── health.ts         # Health check
│   ├── keys.ts           # API key CRUD
│   ├── landing.ts        # Landing page
│   ├── mcp.ts            # MCP endpoint handler
│   └── usage.ts          # Usage stats
├── usage/
│   └── tracker.ts        # Usage logging
├── utils/
│   └── ulid.ts           # ULID generation
├── landing/
│   └── index.html        # Landing page (52KB, dark mode)
├── dashboard/
│   ├── login.html        # Dashboard login
│   └── app.html          # Dashboard app
└── docs/
    └── index.html        # Full API docs

tests/
├── api.test.ts           # Core API tests
├── auth.test.ts          # Auth key generation
├── billing.test.ts       # Billing + webhook tests
├── dashboard.test.ts     # Dashboard tests
├── google-auth.test.ts   # Google OAuth tests
└── landing.test.ts       # Landing page tests
```

## License

Proprietary. © QuantaCodes Solutions.
