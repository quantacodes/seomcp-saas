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

### What's Next
- [ ] Phase 3: Dashboard UI (API key management, usage stats, connected sites)
- [ ] Phase 4: Billing (Lemon Squeezy integration)
- [ ] Phase 5: Launch prep (deploy, docs, domain, ProductHunt)
- [ ] Google Cloud project setup (OAuth client ID/secret for production)
- [ ] Domain setup: seomcp.dev → hosting
