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

### What Works
- Full MCP Streamable HTTP flow: init → get session → call tools → track usage
- Binary bridge spawns seo-mcp-server, communicates via stdio JSON-RPC
- All 35 tools accessible through the HTTP gateway
- API keys, rate limiting, usage tracking all functional

### Known Limitations (Phase 1 MVP)
- No Google OAuth for users — uses empty config (crawl/schema tools work, GSC/GA4 fail gracefully)
- GET /mcp (server-to-client SSE) returns 405 — not needed for MVP
- No session resumability
- No JWT dashboard auth — API keys used for everything
- Rate limit is per-key not per-user (user could create multiple keys)
  - Mitigated: free plan only gets 1 key

### What's Next
- [ ] Phase 1.5: Google OAuth (users connect own GSC/GA4)
- [ ] Phase 2: Landing page (seomcp.dev)
- [ ] Phase 3: Dashboard UI
- [ ] Phase 4: Billing (Lemon Squeezy)
- [ ] Phase 5: Launch prep + deployment
