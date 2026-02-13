# SEO MCP SaaS — Build Log

## Session 1 — 2026-02-13 04:00 IST

### Phase 1: Core API Gateway

**Research:** ✅ Already done (COMPETITION-RESEARCH.md from 2026-02-12)
- Researched 10+ competitors, pricing, MCP transport spec
- Key finding: NO ONE has a hosted SEO MCP SaaS yet

**Specs:** ✅ Written (SPECS.md)
- Full architecture, DB schema, API endpoints, auth flow, rate limiting
- MCP Streamable HTTP transport design
- Binary bridge pattern (spawn seo-mcp Rust binary per user, communicate via stdio)

**Build:** ✅ Complete
- 14 source files, ~750 lines of TypeScript
- Hono HTTP server on Bun
- MCP Streamable HTTP transport (POST /mcp with JSON-RPC)
- API key auth (sk_live_* format, SHA-256 hashed, Bearer token)
- Rate limiting per plan tier (monthly window)
- Usage tracking per key per tool
- Binary pool manager with idle timeout (5min)
- MCP session manager (30min timeout, auto-cleanup)
- Signup + login + API key CRUD
- SQLite with manual migrations (simpler than drizzle-kit for MVP)

**Test:** ✅ 22 tests, 58 assertions, ALL PASSING
- Auth key generation tests (format, uniqueness, deterministic hashing)
- API endpoint tests (signup, login, key management, usage)
- MCP transport tests (auth rejection, session init, tool listing, tool calls)
- Error handling tests (404, missing auth, missing session ID)

**Manual Verification:**
- Server starts clean, health endpoint works
- Signup creates user + returns API key
- MCP initialize returns session ID in Mcp-Session-Id header
- tools/list returns all 35+ seo-mcp tools
- tools/call version returns correct binary info
- tools/call validate_schema works with real URL
- Usage tracking correctly records calls and tool names
- Auth failures return proper 401 responses
- Missing session ID returns 400 with helpful message

**Review:** ✅ Barnacle reviewed — REQUEST_CHANGES (7 MUST, 8 SHOULD, 4 nice-to-have)
- All 7 MUST items fixed
- 5 SHOULD items fixed (#8-12)
- 3 remaining SHOULD items deferred (timing-safe compare, plan type safety, test coverage gaps)
- Verified: session hijack protection works, atomic rate limits work, restart loop protection works

**Commits:**
- 5763c4e — "Phase 1: Core API Gateway"
- 93af3a8 — "Add BUILD-LOG.md and drizzle.config.ts"
- 2567867 — "Fix all 7 Barnacle MUST items + 5 SHOULD items"

---

## Session 2 — 2026-02-13 04:20 IST

### Phase 2: Landing Page

**Specs:** ✅ Written (SPECS-PHASE2.md)
- Page sections: hero, how-it-works, real-data, tools grid, comparison table, pricing, FAQ, CTA, footer
- Signup modal with API key display + pre-filled MCP config
- Dark mode with Tailwind CDN + vanilla JS (no build step)
- Served from same Hono server (no separate frontend)

**Build:** ✅ Complete
- Full landing page with all 9 sections
- Working signup modal: email/password → API key → pre-filled MCP config
- Code snippet copy buttons with toast notification
- FAQ accordion with 7 questions
- Competitor comparison table (vs Ahrefs, DataForSEO, FetchSERP)
- 3-tier pricing (Free $0 / Pro $29 / Agency $79)
- Compatible tools section (Claude, Cursor, Windsurf, any MCP)
- Docs placeholder page
- Mobile-responsive dark mode design

**Test:** ✅ 6 new tests, 34 assertions
- HTML structure, meta tags, section content, signup JS, MCP config snippet, docs page

**Review:** ✅ Barnacle — APPROVE (0 MUST, 7 SHOULD)
- S1 (API key sanity check): Fixed
- S2 (CORS www): Fixed — added www.seomcp.dev to origins
- S4 (readFileSync error handling): Fixed — try-catch with fallback
- S5 (external link rel): Fixed — added noopener noreferrer

**Commits:**
- 8cb1f46 — "Phase 2: Landing page"
- 8a70990 — "Fix Barnacle SHOULD items"

### Phase 1.5: Google OAuth

**Specs:** ✅ Written (SPECS-PHASE1.5.md)
- Google OAuth consent flow for users to connect GSC + GA4
- AES-256-GCM token encryption at rest
- CSRF-protected state parameter
- Per-user config.toml generation for seo-mcp binary
- Token revocation on disconnect

**Build:** ✅ Complete (6 new files, ~500 lines)
- `src/crypto/tokens.ts` — AES-256-GCM encrypt/decrypt with unique IVs
- `src/auth/google.ts` — OAuth consent URL, code exchange, token refresh, revocation
- `src/config/user-config.ts` — Per-user config.toml + google-creds.json generation
- `src/routes/google-auth.ts` — 4 API endpoints (start, callback, status, disconnect)
- `src/db/schema.ts` — google_tokens table
- `src/db/migrate.ts` — Migration for google_tokens
- Updated `src/mcp/transport.ts` — Uses per-user config with Google tokens

**Test:** ✅ 22 new tests, 46 assertions
- Token encryption/decryption (7 tests: format, uniqueness, empty, long, tamper, invalid)
- OAuth state parameter (4 tests: generate, validate, tamper, garbage)
- Per-user config (5 tests: basic, with tokens, has/delete/path)
- Google auth routes (6 tests: 503 no config, missing params, invalid state, denial, auth required)

**Review:** Barnacle — REQUEST_CHANGES (2 critical, 2 high, 3 medium)
- 🔴 #1 XSS in callback HTML: **FIXED** — HTML-escape all dynamic values
- 🔴 #2 HMAC truncation: **FIXED** — Full 256-bit HMAC + timingSafeEqual()
- 🟠 #3 Path traversal: **FIXED** — ULID validation in writeUserConfig()
- 🟠 #4 require() calls: **FIXED** — Top-level ESM imports
- 🟡 #5 Token re-encryption: **FIXED** — Cache updated_at timestamps
- 🟡 #6 /tmp permissions: **FIXED** — 0o600 on credential files
- 🟡 #11 Error leaks: **FIXED** — Generic error messages to users

**Commits:**
- a2b7cf5 — "Phase 1.5: Google OAuth for user GSC/GA4 access"
- 955a83d — "Fix Barnacle review: XSS, HMAC truncation, path traversal, require() → imports"

### Current Stats
- **Total tests:** 50 (all passing)
- **Total assertions:** 138
- **Source files:** ~20
- **Lines of code:** ~2,500
- **Commits:** 9

### What Works (End of Session 2)
- Full MCP Streamable HTTP server with auth, rate limiting, usage tracking
- All 35 seo-mcp tools accessible through HTTP gateway
- Landing page with working signup flow
- Google OAuth flow for connecting user's GSC/GA4
- AES-256-GCM encrypted token storage
- Per-user binary config generation with cached token timestamps
- All security review items addressed

---

## Session 3 — 2026-02-13 05:00 IST

### Phase 3: Dashboard (Review Catch-up)

Phase 3 was already built in Session 2 (commit f3930f0) but not reviewed or logged.

**Review:** ✅ Barnacle — APPROVE (0 MUST, 6 SHOULD, 2 nice-to-have)
- S1-S6: CSRF protection — `requireJson()` not applied to POST mutations
- **FIXED:** Applied requireJson() to POST /dashboard/login, /dashboard/api/keys, /dashboard/api/password
- **FIXED:** Changed DELETE /dashboard/api/keys/:id → POST /dashboard/api/keys/:id/revoke for CSRF safety
- Frontend updated to use POST /revoke endpoint

**Commits:**
- ae83f14 — "Fix Barnacle Phase 3 CSRF review"

### Phase 4: Billing (Lemon Squeezy)

**Specs:** ✅ Written (SPECS-PHASE4.md)
- Lemon Squeezy checkout overlay integration
- Webhook signature verification (HMAC-SHA256 + timingSafeEqual)
- Subscription lifecycle: created → updated → cancelled → expired → resumed
- Idempotency via UNIQUE(event_name, ls_id) + INSERT OR IGNORE
- Dashboard billing section with upgrade/cancel/resume

**Build:** ✅ Complete (6 new files, ~1,700 lines)
- `src/billing/lemonsqueezy.ts` — LS API client (checkout, cancel, resume, variant mapping)
- `src/billing/webhooks.ts` — Webhook verification + event processing (11 event types)
- `src/routes/billing.ts` — 5 billing API endpoints
- `src/db/schema.ts` — subscriptions + webhook_events tables
- `src/db/migrate.ts` — New migrations with UNIQUE idempotency index
- Dashboard billing UI (free upgrade cards, active plan display, cancel/resume flow)

**Test:** ✅ 29 new tests, 57 assertions
- Webhook signature: valid, invalid, null, empty, tampered, garbage (6 tests)
- Plan mapping: pro, agency, numeric, unknown (4 tests)
- Webhook processing: created, idempotent, updated, cancelled, expired, resumed, email fallback, unknown (8 tests)
- Billing routes: auth, CSRF, checkout, webhook sig, portal, cancel, resume, overview (11 tests)

**Review:** ✅ Barnacle — APPROVE (0 MUST, 4 SHOULD, 3 nice-to-have)
- S1 (idempotency race): **FIXED** — UNIQUE index + INSERT OR IGNORE instead of SELECT-then-INSERT
- S2 (subscription_resumed doesn't restore plan): **FIXED** — Added users.plan update
- S3 (unknown variant in updated): **FIXED** — Added warning log
- S4 (order_refunded): Deferred (MVP — stores event for manual review)

**Commits:**
- f25fad2 — "Phase 4: Billing"
- dd1c843 — "Phase 5 + Barnacle Phase 4 fixes"

### Phase 5: Launch Prep

**Build:** ✅ Complete
- Full documentation page at `/docs` (8 sections: quick start, auth, MCP, tools, OAuth, rates, errors, billing)
- Dockerfile + docker-compose.yml + .env.example + .dockerignore
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS)
- Production readiness

**Commits:**
- dd1c843 — "Phase 5: Launch prep"

### Session 3 Stats
- **Total tests:** 102 (all passing)
- **Total assertions:** 262
- **Source files:** ~30
- **Test files:** 6
- **Commits this session:** 4
- **Total commits:** 14

### What Works (End of Session 3)
- ✅ Full MCP Streamable HTTP server with auth + rate limiting + usage tracking
- ✅ All 35 seo-mcp tools accessible through HTTP gateway
- ✅ Landing page with signup flow + MCP config snippet
- ✅ Google OAuth for user's GSC/GA4 (AES-256-GCM encrypted tokens)
- ✅ Dashboard with session auth, usage stats, top tools, API key CRUD, activity feed
- ✅ Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume, plan sync)
- ✅ Documentation page (full API docs)
- ✅ Dockerfile + docker-compose for production deploy
- ✅ Security headers + CSRF protection on all mutations
- ✅ 102 tests, 262 assertions, ALL PASSING

### What's Left Before Launch
- [ ] Domain purchase: seomcp.dev
- [ ] Google Cloud project setup (OAuth client ID/secret)
- [ ] Lemon Squeezy store setup (create products/variants, set webhook URL)
- [ ] Deploy to Fly.io (deploy script ready: `./deploy/deploy.sh --first-run`)
- [ ] DNS + SSL setup (`fly certs add seomcp.dev`)
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64 (`cross build --release --target x86_64-unknown-linux-gnu`)
- [ ] Smoke test in production
- [ ] X announcement thread (draft ready: LAUNCH.md)
- [ ] Product Hunt prep (copy ready: LAUNCH.md)

---

## Session 4 — 2026-02-13 05:20 IST

### Production Polish & Launch Prep

**Build:**
- README.md — Full project documentation (architecture, setup, endpoints, tools, structure)
- LAUNCH.md — Complete launch copy (X thread 9 tweets, Product Hunt listing, Reddit r/SEO + r/artificial, HN Show post)
- deploy/fly.toml — Fly.io production config (shared-cpu-2x, 1GB RAM, IAD region, health checks)
- deploy/deploy.sh — Automated deploy script with first-run setup (secrets, volumes, app creation)
- Enhanced /health — DB liveness check, memory stats, returns 503 when degraded
- X-RateLimit-* headers — Standard rate limit headers on all tool call responses
- X-Request-Id — Correlation ID header on all requests (pass-through or generated)
- CORS — Exposed rate limit + request ID headers to cross-origin clients
- Removed dead /docs placeholder from landing.ts (real docs served by docsRoutes)
- Updated .gitignore (binary, logs)

**Review:** ✅ Barnacle — REQUEST_CHANGES → FIXED
- Fixed: Rate limit headers only on tool calls (not all MCP requests)
- Fixed: Dead fly.toml v1 tcp_checks config

**Commits:**
- 5f3d2d7 — "Session 4: Production polish"
- 1d68126 — "Fix Barnacle S1 + dead fly.toml config"

### Session 4 Stats
- **Total tests:** 102 (all passing)
- **Total assertions:** 261
- **Source files:** ~30
- **Total commits:** 16

---

## Session 5 — 2026-02-13 05:40 IST

### Admin API + Tools Catalog + Barnacle Fixes

**Build:**
- Admin API: 6 endpoints with X-Admin-Secret auth
  - GET /api/admin/stats — User counts, usage, billing, runtime, top tools
  - GET /api/admin/users — Paginated user list with filters
  - GET /api/admin/users/:id — Detailed user view (keys, usage, subscription)
  - POST /api/admin/users/:id/plan — Manual plan override
  - GET /api/admin/usage/hourly — 24h hourly breakdown
  - GET /api/admin/errors — Recent errors with user context
- OpenAPI 3.1 spec at /openapi.json (Swagger/Postman compatible)
- /.well-known/mcp discovery endpoint per MCP spec
- /tools — Full SEO tool catalog page (29 tools, 9 categories, params, examples, badges)
- /api/tools — JSON endpoint for programmatic tool discovery
- /setup — Serves installer script (`curl -fsSL https://seomcp.dev/setup | bash`)
- Structured JSON logger (src/utils/logger.ts) for production observability
- E2E smoke test script (scripts/smoke-test.sh) — 16 checks
- MCP client auto-setup script (scripts/setup-mcp.sh) — detects Claude/Cursor/Windsurf
- Improved error handler with structured JSON + request ID correlation

**Review:** ✅ Barnacle — REQUEST_CHANGES (3 MUST, 7 SHOULD, 6 nice-to-have) → ALL MUST FIXED
- 🔴 #1 SQL injection in admin users count: **FIXED** — parameterized query
- 🔴 #2 Password hash leak via SELECT *: **FIXED** — explicit column list
- 🔴 #3 Timing-unsafe admin secret comparison: **FIXED** — timingSafeEqual()
- 🟠 #4 parseInt NaN guard: **FIXED** — `parseInt(x) || default` + Math.max
- 🟠 #5 Hourly query type annotation: **FIXED** — [number] → [number, number]
- 🟠 #7 LEFT JOIN for errors: **FIXED** — preserves errors with deleted users
- 🟠 #12 VERSION in MCP discovery: **FIXED** — uses config.VERSION

**Test:** ✅ 131 tests, 349 assertions, ALL PASSING
- 18 new admin tests (auth, stats, users, plan changes, usage, errors)
- 11 new tools/OpenAPI tests (catalog HTML, JSON API, spec structure)

**Commits:**
- 19f0fb5 — "Session 5: Admin API, smoke test, OpenAPI spec, MCP discovery, structured logging"
- 38a52da — "Fix Barnacle MUST items + tools catalog page"

### Session 5 Stats
- **Total tests:** 131 (all passing)
- **Total assertions:** 349
- **Test files:** 8
- **Source files:** ~35
- **Total commits:** 18

### What Works (End of Session 5)
- ✅ Full MCP Streamable HTTP server with auth + rate limiting + usage tracking
- ✅ All 35 seo-mcp tools accessible through HTTP gateway
- ✅ Landing page with signup flow + MCP config snippet
- ✅ Google OAuth for user's GSC/GA4 (AES-256-GCM encrypted tokens)
- ✅ Dashboard with session auth, usage stats, top tools, API key CRUD, activity feed
- ✅ Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume, plan sync)
- ✅ Full documentation page (8 sections)
- ✅ **Admin API** (stats, users, plan management, usage analytics, error listing)
- ✅ **Tool catalog page** (/tools) with 29 tools, categories, params, examples
- ✅ **OpenAPI 3.1 spec** at /openapi.json
- ✅ **MCP discovery** at /.well-known/mcp
- ✅ **Setup script** at /setup (curl | bash installer)
- ✅ Dockerfile + docker-compose + Fly.io deploy config
- ✅ Security headers + CSRF + rate limit headers + request IDs
- ✅ Timing-safe admin auth + parameterized SQL everywhere
- ✅ E2E smoke test + MCP client setup scripts
- ✅ 131 tests, 349 assertions, ALL PASSING

### What's Left Before Launch
- [ ] Domain purchase: seomcp.dev
- [ ] Google Cloud project setup (OAuth client ID/secret)
- [ ] Lemon Squeezy store setup (create products/variants, set webhook URL)
- [ ] Deploy to Fly.io (deploy script ready: `./deploy/deploy.sh --first-run`)
- [ ] DNS + SSL setup (`fly certs add seomcp.dev`)
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64
- [ ] Smoke test in production
- [ ] X announcement thread (draft ready: LAUNCH.md)
- [ ] Product Hunt prep (copy ready: LAUNCH.md)

---

## Session 6 — 2026-02-13 07:11 IST

### Interactive Playground + SEO Polish + Security Hardening

**Build:** ✅ Complete
- **Interactive Playground** at `/playground` — try 3 tools (crawl_page, validate_schema, core_web_vitals) without signup
  - Per-IP rate limiting (5 calls/hour), validation before rate-limit (don't burn quota on bad requests)
  - Comprehensive SSRF protection: IPv4 private (10.x, 192.168.x, 172.16-31.x), IPv6 (::1, ::), link-local (169.254.x), cloud metadata (.internal suffix)
  - Shared demo binary instance with auto-cleanup on crash
  - Beautiful dark UI matching the rest of the site
- **JSON-LD structured data** on landing page (@graph with SoftwareApplication + Organization + FAQPage)
- **Canonical URL** added to landing page
- **Binary auto-retry** — `sendWithRetry()` retries once if binary crashes mid-request
- **robots.txt** — blocks /dashboard and /api/, includes sitemap reference
- **sitemap.xml** — 4 marketing pages with startup-time lastmod
- **Graceful shutdown** — demo binary and cleanup timer properly stopped
- Fixed "All 29 Tools" → "All 35 Tools" in landing footer
- Fixed duplicate "Tools" nav links — replaced with Playground link
- Hero CTA: "Try It Live" button linking to /playground
- Cross-links: playground added to tools page footer

**Test:** ✅ 19 new tests, 45 assertions
- Page rendering (HTML structure, SEO meta, CTA)
- API validation (missing tool, non-demo tool, missing args)
- SSRF protection (localhost, 127.0.0.1, IPv6 ::1, 192.168.x, 10.x, 172.17-31.x, 169.254.x, cloud metadata)
- Input validation (invalid URL, non-http protocol, invalid JSON)

**Review:** ✅ Barnacle — REQUEST_CHANGES (1 MUST, 3 SHOULD, 3 nice-to-have) → ALL FIXED
- 🔴 #1 `demoBinaryReady` undefined variable in crash handler: **FIXED** → `demoBinary = null`
- 🟠 #2 SSRF bypass via IPv6/link-local/172.17-31: **FIXED** → comprehensive `isPrivateHost()`
- 🟠 #3 In-memory rate limiting: Acceptable for MVP, documented as known limitation
- 🟠 #4 `setInterval` never cleared: **FIXED** → exported `stopDemoCleanup()`, wired to shutdown
- 🟡 #5 Dynamic sitemap lastmod: **FIXED** → uses build date (set once at startup)
- 🟡 #6 "All 29 Tools" → "All 35 Tools": **FIXED**
- 🟡 #7 Test cleanup: Deferred (Bun test limitation with parallel runs)

**Commits:**
- 8b6bda6 — "Session 6: Playground, structured data, binary auto-retry, SEO polish"
- 6740eeb — "Fix Barnacle review: SSRF IPv6/link-local, crash handler, cleanup, footer"

### Session 6 Stats
- **Total tests:** 150 (all passing)
- **Total assertions:** 387
- **Test files:** 9
- **Source files:** ~36
- **Total commits:** 22

### What Works (End of Session 6)
- ✅ Full MCP Streamable HTTP server with auth + rate limiting + usage tracking
- ✅ All 35 seo-mcp tools accessible through HTTP gateway
- ✅ Landing page with signup flow + MCP config snippet + JSON-LD structured data
- ✅ **Interactive Playground** — try tools without signup, SSRF-hardened
- ✅ Google OAuth for user's GSC/GA4 (AES-256-GCM encrypted tokens)
- ✅ Dashboard with session auth, usage stats, top tools, API key CRUD, activity feed
- ✅ Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume, plan sync)
- ✅ Full documentation page (8 sections)
- ✅ Admin API (stats, users, plan management, usage analytics, error listing)
- ✅ Tool catalog page (/tools) with 35 tools, categories, params, examples
- ✅ OpenAPI 3.1 spec at /openapi.json
- ✅ MCP discovery at /.well-known/mcp
- ✅ Setup script at /setup (curl | bash installer)
- ✅ robots.txt + sitemap.xml
- ✅ Binary auto-retry on crash
- ✅ Graceful shutdown (cleanup timers, demo binary, all pool instances)
- ✅ Dockerfile + docker-compose + Fly.io deploy config
- ✅ Security headers + CSRF + rate limit headers + request IDs
- ✅ 150 tests, 387 assertions, ALL PASSING

### What's Left Before Launch
- [ ] Domain purchase: seomcp.dev
- [ ] Google Cloud project setup (OAuth client ID/secret)
- [ ] Lemon Squeezy store setup (create products/variants, set webhook URL)
- [ ] Deploy to Fly.io
- [ ] DNS + SSL
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64
- [ ] Production smoke test
- [ ] X announcement + Product Hunt (drafts ready: LAUNCH.md)

---

## Session 7 — 2026-02-13 07:51 IST

### Production Hardening, E2E Tests, Legal Pages

**Build:**
- **IP rate limiting** on signup (5/hr) and login (10/15min) per IP
  - Rate limit applied AFTER validation — don't burn quota on malformed requests
  - `getClientIp()` — uses Fly-Client-IP/CF-Connecting-IP (proxy-level, not spoofable)
  - Falls back to X-Forwarded-For only in dev/test or with TRUSTED_PROXY=true
  - `"no-ip"` fallback skips rate limiting (avoids shared bucket DoS)
- **Unified rate limiting** — dashboard login migrated to shared rate-limit-ip module
  - Removed duplicate loginAttempts Map + setInterval from dashboard.ts
  - Cleanup uses fixed 2-hour threshold (fixes first-caller-wins windowMs bug)
- **Structured JSON request logger** with timing (replaces hono/logger)
  - Health check logs suppressed (noisy)
- **Terms of Service** page at /terms
- **Privacy Policy** page at /privacy
  - Google data handling section (required for OAuth verification)
  - Google API Services User Data Policy compliance statement
  - Data table: what's collected, purpose, retention
  - "What we DON'T collect" section
- **Sitemap** updated with /terms and /privacy
- Landing page footer links updated to real /terms and /privacy
- Config: lemonSqueezy uses getter for test isolation (fixes 15 flaky tests)
- Graceful shutdown includes IP rate limit cleanup

**Test:** ✅ 30 new tests, 127 new assertions
- E2E integration test (21 tests): complete user journey from signup to dashboard
  - Signup → Login → MCP init → tools/list → tools/call → usage tracking
  - Dashboard login → key management → plan limits → key revocation
  - Signup rate limiting (IP-based, blocks after 5)
  - Input validation edge cases (empty email, short password, non-JSON body)
- Legal page tests (9 tests): terms content, privacy content, sitemap

**Review:** ✅ Barnacle — REQUEST_CHANGES (1 MUST, 3 SHOULD, 2 nice-to-have) → ALL FIXED
- 🔴 #1 X-Forwarded-For spoofable without trusted proxy: **FIXED** — getClientIp() uses proxy headers
- 🟠 #2 "unknown" IP shared bucket DoS: **FIXED** — "no-ip" skips rate limiting
- 🟠 #3 Duplicate rate limiting in dashboard.ts: **FIXED** — unified to shared module
- 🟠 #4 `as const` removal: Accepted — minimal type safety impact, getter pattern requires it
- 🟡 #5 startCleanup first-caller windowMs: **FIXED** — fixed 2h threshold
- 🟡 #6 Fixed window burst: Acceptable for MVP

**Commits:**
- 382f347 — "Session 7: IP rate limiting, structured logging, E2E test, test isolation fixes"
- fdd0481 — "Fix Barnacle review + legal pages + sitemap"

### Session 7 Stats
- **Total tests:** 180 (all passing)
- **Total assertions:** 493
- **Test files:** 11
- **Source files:** ~38
- **Total commits:** 24

### What Works (End of Session 7)
- ✅ Full MCP Streamable HTTP server with auth + rate limiting + usage tracking
- ✅ All 35 seo-mcp tools accessible through HTTP gateway
- ✅ Landing page with signup flow + MCP config snippet + JSON-LD structured data
- ✅ Interactive Playground — try tools without signup, SSRF-hardened
- ✅ Google OAuth for user's GSC/GA4 (AES-256-GCM encrypted tokens)
- ✅ Dashboard with session auth, usage stats, top tools, API key CRUD, activity feed
- ✅ Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume, plan sync)
- ✅ Full documentation page (8 sections)
- ✅ Admin API (stats, users, plan management, usage analytics, error listing)
- ✅ Tool catalog page (/tools) with 35 tools, categories, params, examples
- ✅ OpenAPI 3.1 spec at /openapi.json
- ✅ MCP discovery at /.well-known/mcp
- ✅ Setup script at /setup (curl | bash installer)
- ✅ **Terms of Service** at /terms
- ✅ **Privacy Policy** at /privacy (Google compliance)
- ✅ **IP rate limiting** on signup/login (proxy-aware, not spoofable)
- ✅ **Unified rate limiting** module (removed dashboard duplicate)
- ✅ **Structured JSON logging** with request timing
- ✅ **E2E integration test** (complete user journey)
- ✅ robots.txt + sitemap.xml (6 pages)
- ✅ Binary auto-retry on crash
- ✅ Graceful shutdown (cleanup timers, demo binary, all pool instances)
- ✅ Dockerfile + docker-compose + Fly.io deploy config
- ✅ Security headers + CSRF + rate limit headers + request IDs
- ✅ 180 tests, 493 assertions, ALL PASSING

### What's Left Before Launch (Session 7)
- [ ] Domain purchase: seomcp.dev
- [ ] Google Cloud project setup (OAuth client ID/secret)
- [ ] Lemon Squeezy store setup (create products/variants, set webhook URL)
- [ ] Deploy to Fly.io (`./deploy/deploy.sh --first-run`)
- [ ] DNS + SSL (`fly certs add seomcp.dev`)
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64
- [ ] Set TRUSTED_PROXY=true in production env
- [ ] Production smoke test
- [ ] X announcement + Product Hunt (drafts ready: LAUNCH.md)

---

## Session 8 — 2026-02-13 08:20 IST

### Phase 6: Audit History + Key Scoping + Polish

**Specs:** ✅ Written (SPECS-PHASE6.md)

**Build:** ✅ Complete (1,539 lines across 19 files)
- **Audit History** — Auto-captures generate_report/site_audit/crawl_page results
  - Plan-based retention: free 7d/10, pro 30d/100, agency 90d/1000
  - Dashboard API: list, filter by site, full result view, health trend
  - Health score extraction + summary metrics
- **Key Scoping** — Restrict API keys to tool categories
  - 9 categories: crawl, gsc, ga4, schema, indexnow, cwv, report, storage, meta
  - Enforced at MCP transport layer before rate limit check
  - Validation + description helpers
- **Changelog** page at /changelog (timeline UI, v0.1.0 + v0.2.0)
- **OG meta tags** on docs, terms, privacy pages
- **Dashboard UI:** audit history tab, health trend chart, scoped key creation
- DB migrations for audit_history table + api_keys.scopes column

**Test:** ✅ 63 new tests (243 total, 618 assertions)

**Review:** ✅ Barnacle — APPROVE
**Commits:** 7fc9857, 74084e2

---

## Session 9 — 2026-02-13 08:40 IST

### Phase 7: User Webhooks + Scheduled Audits

**Specs:** ✅ Written (SPECS-PHASE7.md)

**Build:** ✅ Complete (2,331 lines across 15 files)
- **User Webhook System** — HMAC-SHA256 signed delivery, SSRF protection, audit + usage alerts
- **Scheduled Audits Engine** — daily/weekly/monthly, plan limits, concurrent execution
- **Dashboard UI** for both features
- Usage alert notifications at 80%/100% thresholds

**Test:** ✅ 53 new tests (296 total)

**Review:** ✅ Barnacle — REQUEST_CHANGES → FIXED
**Commits:** e70a0c8, fa6d712, 2ca1ff6

---

## Session 10 — 2026-02-13 09:20 IST

### Phase 8: Email Verification

**Specs:** ✅ Written (SPECS-PHASE8.md)

**Build:** ✅ Complete (916 lines across 18 files)
- HMAC-SHA256 verification tokens (24h expiry, timing-safe compare)
- Resend API integration (HTML emails, console fallback)
- GET /verify magic link + POST /api/auth/resend-verification
- Unverified free users: 10 calls/month (vs 50 verified)
- Dashboard verification banner with resend button
- emailVerified in AuthContext, SessionData, API responses

**Test:** ✅ 23 new tests (319 total)

**Review:** ✅ Barnacle — APPROVE (P2: rate limit header mismatch, XSS foot-gun in HTML helper)
**Commits:** bef410e

---

## Session 11 — 2026-02-13 09:40 IST

### Phase 9: Team/Organization Support + Verification Bug Fixes + Key Rotation

**Bug Fixes:**
- **Resend-verification stored raw token** instead of hash → Fixed to use `hashVerificationToken(token)`
- **Verification test** read hashed token from DB and used as raw → Fixed to capture raw token from console.log
- **Dynamic import** in verify.ts resend handler → Replaced with static import
- **XSS foot-gun** in `verificationResultHtml()` → Renamed param to `trustedHtml` with explicit JSDoc warning

**Test Infrastructure:**
- Created `scripts/test.sh` — runs each test file in own Bun process
- Fixes shared module cache issue (SQLite DB path) with Bun's parallel test runner
- `bun test` alone still fails with 35 failures — use `bash scripts/test.sh` or `bun run test`

**Build:** ✅ Complete — Phase 9: Teams

**Team/Organization Support** (6 new files, ~1,000 lines)
- `src/teams/teams.ts` — Team CRUD (create in transaction, get, update, delete, roles, usage)
- `src/teams/invites.ts` — HMAC-SHA256 invite tokens (48h expiry, hash-before-store)
- `src/routes/teams.ts` — 9 API endpoints with session auth + CSRF protection
- DB tables: `teams` + `team_members` with UNIQUE index
- Only agency/enterprise plan can create teams (max 5 members)
- Auto-join for existing users, pending invites for new emails
- Role hierarchy: owner > admin > member
- Invite email acceptance verifies accepting user's email matches invite email
- Team-aware rate limiting: aggregate usage across all members vs team plan quota
- MCP transport checks team-level limits before individual limits
- Invite emails via Resend API (console fallback in dev)

**API Key Rotation** (POST /dashboard/api/keys/:id/rotate)
- Atomic revoke-old + create-new in SQLite transaction
- Preserves key name and scopes
- Returns new raw key (shown once)

**Review:** ✅ Barnacle — APPROVE (4 minor findings, all addressed)
- #1 TOCTOU in createTeam → FIXED: wrapped in transaction
- #2 TOCTOU in createInvite → Accepted: SQLite serializes writes
- #3 Dead code in leaveTeam → Kept as defensive code
- #4 Invite acceptance email mismatch → FIXED: verify email matches

**Test:** ✅ 352 tests, 817 assertions, ALL PASSING
- 30 new team tests
- 3 new key rotation tests
- Test runner fix (sequential execution)

**Commits:**
- 0e33568 — "Session 11: Team support, verification bug fixes, test runner"
- a44687e — "Fix Barnacle review items + key rotation + team-aware MCP rate limiting"

### Session 11 Stats
- **Total tests:** 352 (all passing)
- **Total assertions:** 817
- **Test files:** 18
- **Source files:** 51
- **Lines of code:** ~10,800
- **Total commits:** 30

### What Works (End of Session 11)
- ✅ Full MCP Streamable HTTP server with auth + rate limiting + usage tracking
- ✅ All 35 seo-mcp tools accessible through HTTP gateway
- ✅ Landing page with signup flow + MCP config snippet + JSON-LD structured data
- ✅ Interactive Playground — try tools without signup, SSRF-hardened
- ✅ Google OAuth for user's GSC/GA4 (AES-256-GCM encrypted tokens)
- ✅ Dashboard with session auth, usage stats, top tools, API key CRUD, activity feed
- ✅ **Team/Organization support** — create team, invite members, role management, shared usage pool
- ✅ **API key rotation** — atomic revoke + create
- ✅ **Team-aware MCP rate limiting** — aggregate team usage enforcement
- ✅ Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume, plan sync)
- ✅ Full documentation page (8 sections)
- ✅ Admin API (stats, users, plan management, usage analytics, error listing)
- ✅ Tool catalog page (/tools) with 35 tools, categories, params, examples
- ✅ OpenAPI 3.1 spec at /openapi.json
- ✅ MCP discovery at /.well-known/mcp
- ✅ Setup script at /setup (curl | bash installer)
- ✅ Email verification with magic links (Resend API)
- ✅ Audit history, user webhooks, scheduled audits
- ✅ Key scoping (restrict to tool categories), changelog
- ✅ Terms of Service + Privacy Policy (Google compliance)
- ✅ IP rate limiting on signup/login + structured JSON logging
- ✅ E2E integration test (complete user journey)
- ✅ robots.txt + sitemap.xml + security headers
- ✅ Dockerfile + docker-compose + Fly.io deploy config
- ✅ 352 tests, 817 assertions, ALL PASSING

### What's Left Before Launch
- [ ] Domain purchase: seomcp.dev
- [ ] Resend account + domain verification
- [ ] Google Cloud project setup (OAuth client ID/secret)
- [ ] Lemon Squeezy store setup
- [ ] Deploy to Fly.io
- [ ] DNS + SSL
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64
- [ ] Production smoke test
- [ ] X announcement + Product Hunt (drafts ready: LAUNCH.md)

---

## Session 12 — 2026-02-13 10:02 IST

### Phase 10: Password Reset + UX Polish

**Build:** ✅ Complete

**Password Reset Flow** (4 routes, ~500 lines)
- `src/auth/password-reset.ts` — HMAC-SHA256 tokens (1h expiry), domain-separated key
- `src/routes/password-reset.ts` — POST forgot-password, GET reset-password form, POST reset-password, GET forgot-password form
- Hash-before-store, timing-safe comparison, single-use enforcement
- Superseded token detection (GET validates stored hash)
- Anti-enumeration (forgot-password always returns identical 200)
- IP rate limiting: 3/hr forgot, 5/hr reset
- XSS prevention via escapeHtml on all dynamic values

**Onboarding Checklist** (replaces simple quickstart)
- 5-step wizard: account, verify email, add MCP config, connect Google, first tool call
- Auto-detects completion from overview data
- Auto-dismisses when all 5 steps complete
- Progress badge (X/5 complete)
- Scroll-to-section for Google connection step

**Custom Error Pages**
- HTML 404/500 pages for browser requests (JSON for API/MCP clients)
- Styled to match site design, with navigation links

**Usage Alert Emails**
- Email notification at 80% and 100% usage quota
- Deduplication: email fires once per threshold per month
- HTML email with visual progress bar + upgrade CTA
- Console fallback when RESEND_API_KEY not set

**Other Fixes**
- "Forgot password?" link on login page
- DB migration for reset_token + reset_sent_at columns

**Review:** ✅ Barnacle — APPROVE (0 MUST, 2 SHOULD fixed, 1 NICE fixed)
- Fixed: Broken link in resetResultHtml (/api/auth/forgot-password-form → /forgot-password)
- Fixed: GET /reset-password now validates stored hash (superseded token detection)

**Test:** ✅ 31 new tests, 62 assertions

**Commits:**
- 251c10e — "Session 12: Password reset + custom error pages"
- 2f191f1 — "Onboarding checklist + custom error pages"
- ed3d21a — "Usage alert emails at 80% and 100% quota"

### Session 12 Stats
- **Total tests:** 383 (all passing)
- **Total assertions:** 879
- **Test files:** 19
- **Source files:** 53 (.ts) + 3 (.html)
- **Lines of code:** ~11,000 TS + ~3,200 HTML + ~5,500 test
- **Total commits:** 41

### What Works (End of Session 12)
- ✅ Full MCP Streamable HTTP server with auth + rate limiting + usage tracking
- ✅ All 35 seo-mcp tools accessible through HTTP gateway
- ✅ Landing page with signup flow + MCP config snippet + JSON-LD structured data
- ✅ Interactive Playground — try tools without signup, SSRF-hardened
- ✅ Google OAuth for user's GSC/GA4 (AES-256-GCM encrypted tokens)
- ✅ Dashboard with session auth, usage stats, top tools, API key CRUD, activity feed
- ✅ **Onboarding checklist** — 5-step guided setup, auto-completion detection
- ✅ **Password reset** — forgot password flow with magic links
- ✅ **Usage alert emails** — notifications at 80% and 100% quota
- ✅ **Custom error pages** — styled HTML 404/500 for browsers
- ✅ Team/Organization support — create team, invite members, role management
- ✅ API key rotation — atomic revoke + create
- ✅ Team-aware MCP rate limiting — aggregate team usage enforcement
- ✅ Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume, plan sync)
- ✅ Full documentation page (8 sections)
- ✅ Admin API (stats, users, plan management, usage analytics, error listing)
- ✅ Tool catalog page (/tools) with 35 tools, categories, params, examples
- ✅ OpenAPI 3.1 spec at /openapi.json
- ✅ MCP discovery at /.well-known/mcp
- ✅ Setup script at /setup (curl | bash installer)
- ✅ Email verification with magic links (Resend API)
- ✅ Audit history, user webhooks, scheduled audits
- ✅ Key scoping (restrict to tool categories), changelog
- ✅ Terms of Service + Privacy Policy (Google compliance)
- ✅ IP rate limiting on signup/login + structured JSON logging
- ✅ E2E integration test (complete user journey)
- ✅ robots.txt + sitemap.xml + security headers
- ✅ Dockerfile + docker-compose + Fly.io deploy config
- ✅ 383 tests, 879 assertions, ALL PASSING

### What's Left Before Launch
- [ ] Domain purchase: seomcp.dev
- [ ] Resend account + domain verification (for emails)
- [ ] Google Cloud project setup (OAuth client ID/secret)
- [ ] Lemon Squeezy store setup (products/variants/webhook URL)
- [ ] Deploy to Fly.io (`./deploy/deploy.sh --first-run`)
- [ ] DNS + SSL (`fly certs add seomcp.dev`)
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64
- [ ] Set TRUSTED_PROXY=true in production env
- [ ] Production smoke test
- [ ] X announcement + Product Hunt (drafts ready: LAUNCH.md)

---

## Session 13 — 2026-02-13 10:20 IST

### Final Polish & Documentation

**Build:** ✅ Complete
- **DEPLOY.md** — Step-by-step deployment guide (9 steps: cross-compile → Fly.io → DNS → smoke test → launch)
- **SECURITY.md** — Security policy (vulnerability reporting, all security measures documented)
- **README.md overhaul** — Complete endpoints table (40+ endpoints across 6 categories), accurate project structure (53 source files), correct test counts
- **Changelog v0.3.0** — Added new version entry for teams, email verification, password reset, webhooks, scheduled audits
- **.env.example** — Added missing ADMIN_SECRET, HOST, TRUSTED_PROXY documentation
- **Test fix** — Updated changelog test for renamed v0.1.0 title

**Commits:**
- 9a3ea9f — "Session 13: Final polish — DEPLOY.md, SECURITY.md, README overhaul, changelog v0.3.0, env docs"

### Session 13 Stats
- **Total tests:** 383 (all passing)
- **Total assertions:** 879
- **Test files:** 19
- **Source files:** 53
- **Total commits:** 42

### 🏁 PROJECT STATUS: CODE COMPLETE

All code is written, reviewed, and tested. The product is ready for deployment.

**What was built (13 sessions, ~12 hours):**
- Full MCP Streamable HTTP SaaS wrapping 35-tool Rust binary
- Landing page, playground, tool catalog, docs, changelog
- Dashboard with usage stats, key management, audit history
- Google OAuth for user's GSC/GA4 (encrypted token storage)
- Lemon Squeezy billing (3 tiers: Free/Pro/Agency)
- Team/org support with shared usage pools
- Email verification, password reset, onboarding wizard
- User webhooks (HMAC-signed), scheduled audits
- Admin API (stats, user management, plan overrides)
- IP rate limiting, CSRF protection, security headers
- OpenAPI 3.1 spec, MCP discovery, robots.txt, sitemap.xml
- Terms of Service, Privacy Policy (Google OAuth compliance)
- Dockerfile + Fly.io deployment config
- Step-by-step deployment guide
- 383 tests, 879 assertions across 19 test files

**What's left (all external, no code needed):**
1. Buy domain: seomcp.dev
2. Set up external services: Google Cloud, Resend, Lemon Squeezy
3. Cross-compile Rust binary for linux-amd64
4. Deploy to Fly.io (follow DEPLOY.md)
5. Launch on X, Product Hunt, HN, Reddit (copy in LAUNCH.md)
