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

### Public
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Landing page |
| `/health` | GET | Health check (DB liveness + memory) |
| `/docs` | GET | API documentation (8 sections) |
| `/tools` | GET | Tool catalog (35 tools, categories, examples) |
| `/playground` | GET | Try tools without signup (SSRF-hardened) |
| `/changelog` | GET | Release changelog |
| `/terms` | GET | Terms of Service |
| `/privacy` | GET | Privacy Policy |
| `/openapi.json` | GET | OpenAPI 3.1 specification |
| `/.well-known/mcp` | GET | MCP server discovery |
| `/setup` | GET | curl \| bash installer script |
| `/robots.txt` | GET | Robots directives |
| `/sitemap.xml` | GET | XML sitemap |

### Auth
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/signup` | POST | — | Create account + get API key |
| `/api/auth/login` | POST | — | Login (returns API key) |
| `/verify` | GET | Token | Email verification magic link |
| `/api/auth/resend-verification` | POST | Session | Resend verification email |
| `/forgot-password` | GET/POST | — | Password reset request |
| `/reset-password` | GET/POST | Token | Password reset form |

### MCP
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mcp` | POST | API key | MCP Streamable HTTP (JSON-RPC) |

### Dashboard
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/dashboard` | GET | Session | Web dashboard |
| `/dashboard/api/keys` | GET/POST | Session | API key management |
| `/dashboard/api/keys/:id/revoke` | POST | Session | Revoke key |
| `/dashboard/api/keys/:id/rotate` | POST | Session | Rotate key (atomic) |
| `/dashboard/api/overview` | GET | Session | Usage stats + onboarding |
| `/dashboard/api/audits` | GET | Session | Audit history |
| `/dashboard/api/webhooks` | GET/POST | Session | Webhook management |
| `/dashboard/api/schedules` | GET/POST | Session | Scheduled audits |
| `/dashboard/api/teams` | GET/POST | Session | Team management |
| `/dashboard/api/billing/*` | GET/POST | Session | Billing (checkout, cancel, resume) |

### Google OAuth
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/google/start` | GET | Session | Start Google OAuth |
| `/api/auth/google/callback` | GET | — | OAuth callback |
| `/api/auth/google/status` | GET | API key | Check connection status |
| `/api/auth/google/disconnect` | POST | API key | Disconnect Google |

### Admin
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/stats` | GET | Admin secret | System stats |
| `/api/admin/users` | GET | Admin secret | User list (paginated, filterable) |
| `/api/admin/users/:id` | GET | Admin secret | User detail |
| `/api/admin/users/:id/plan` | POST | Admin secret | Manual plan override |
| `/api/admin/usage/hourly` | GET | Admin secret | 24h usage breakdown |
| `/api/admin/errors` | GET | Admin secret | Recent errors |

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
bun run test       # 383 tests, 879 assertions (serial, isolated DBs)
bun test --watch   # Watch mode
```

## Project Structure

```
src/
├── index.ts              # Hono app + middleware + graceful shutdown
├── config.ts             # Environment config + plan limits
├── types.ts              # Shared TypeScript types
├── tools-catalog.ts      # 35 tools metadata (categories, params, examples)
├── auth/
│   ├── google.ts         # Google OAuth (consent, exchange, refresh, revoke)
│   ├── keys.ts           # API key generation (sk_live_* format, SHA-256 hashed)
│   ├── middleware.ts      # Bearer token auth middleware
│   ├── password-reset.ts # HMAC-SHA256 reset tokens (1h expiry)
│   ├── scopes.ts         # API key tool category scoping (9 categories)
│   ├── session.ts        # Dashboard session management (cookie-based)
│   └── verification.ts   # Email verification (HMAC tokens, Resend API)
├── audit/
│   └── history.ts        # Audit result capture + plan-based retention
├── billing/
│   ├── lemonsqueezy.ts   # Lemon Squeezy API client
│   └── webhooks.ts       # Webhook verification + event processing (11 types)
├── config/
│   └── user-config.ts    # Per-user config.toml + google-creds.json generation
├── crypto/
│   └── tokens.ts         # AES-256-GCM encrypt/decrypt with unique IVs
├── db/
│   ├── index.ts          # SQLite connection (WAL mode)
│   ├── migrate.ts        # Schema migrations
│   └── schema.ts         # Database schema (12 tables)
├── mcp/
│   ├── binary.ts         # Rust binary process pool (idle timeout, auto-retry)
│   ├── session.ts        # MCP session manager (30min timeout)
│   └── transport.ts      # MCP Streamable HTTP transport + rate limit + scopes
├── middleware/
│   └── rate-limit-ip.ts  # Per-IP rate limiting (proxy-aware)
├── ratelimit/
│   └── middleware.ts      # Monthly plan rate limit enforcement
├── routes/               # 22 route modules
│   ├── admin.ts          # Admin API (6 endpoints, stats/users/plan/usage/errors)
│   ├── audits.ts         # Audit history API
│   ├── auth.ts           # Signup/login endpoints
│   ├── billing.ts        # Billing API (checkout, webhooks, portal)
│   ├── changelog.ts      # Changelog page
│   ├── dashboard.ts      # Dashboard pages + API
│   ├── docs.ts           # Documentation page (8 sections)
│   ├── google-auth.ts    # Google OAuth endpoints
│   ├── health.ts         # Health check (DB + memory)
│   ├── keys.ts           # API key CRUD + rotation
│   ├── landing.ts        # Landing page (JSON-LD, OG tags)
│   ├── legal.ts          # Terms + Privacy pages
│   ├── mcp.ts            # MCP endpoint handler
│   ├── openapi.ts        # OpenAPI 3.1 spec
│   ├── password-reset.ts # Forgot/reset password flow
│   ├── playground.ts     # Interactive playground (SSRF-hardened)
│   ├── schedules.ts      # Scheduled audit management
│   ├── teams.ts          # Team/org management (9 endpoints)
│   ├── tools.ts          # Tool catalog page + JSON API
│   ├── usage.ts          # Usage stats
│   ├── verify.ts         # Email verification magic link
│   └── webhook-settings.ts # User webhook CRUD
├── scheduler/
│   └── engine.ts         # Scheduled audit execution engine
├── teams/
│   ├── invites.ts        # HMAC-SHA256 invite tokens (48h expiry)
│   └── teams.ts          # Team CRUD + role management
├── usage/
│   └── tracker.ts        # Usage logging + alert emails (80%/100%)
├── utils/
│   ├── logger.ts         # Structured JSON logger
│   └── ulid.ts           # ULID generation
└── webhooks/
    └── user-webhooks.ts  # HMAC-SHA256 signed webhook delivery

tests/                    # 19 test files, 383 tests, 879 assertions
scripts/
├── smoke-test.sh         # E2E smoke test (16 checks)
├── setup-mcp.sh          # MCP client auto-setup (Claude/Cursor/Windsurf)
└── test.sh               # Sequential test runner (isolated DBs)
deploy/
├── fly.toml              # Fly.io production config
└── deploy.sh             # Automated deploy script
```

## License

Proprietary. © QuantaCodes Solutions.
