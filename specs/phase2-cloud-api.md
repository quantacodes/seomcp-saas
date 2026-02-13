# Phase 2 Spec: Proxy API Routes (REVISED — Delta on Existing Server)

**Priority:** P0 — Day 2-3 Build
**Assignee:** Chitin (Developer)
**Reviewer:** Barnacle (Code Review)
**QA:** Reef (Testing)

---

## Context

The existing server (`src/`) already has:
- Hono + Bun runtime with full middleware stack
- Auth middleware, API key hashing (SHA-256), rate limiting
- BinaryPool + BinaryInstance for long-lived MCP binary sessions
- SQLite + Drizzle ORM with comprehensive schema
- Health, tools catalog, dashboard, billing, admin routes
- Google OAuth, Lemon Squeezy integration
- Structured logging (no body logging), security headers, CORS

**This phase adds 4 new routes + a simple per-request spawner to support the @seomcp/proxy client.** We are NOT building a new server.

---

## What to Build

### New Files (~680 lines total)

```
src/
├── routes/
│   └── proxy.ts              # NEW — All 4 proxy-facing endpoints
├── services/
│   └── proxy-spawner.ts      # NEW — Per-request binary spawner (creds via temp file)
│   └── concurrency-pool.ts   # NEW — Bounded semaphore for proxy spawns
```

### Modified Files
```
src/
├── index.ts                  # ADD: import + mount proxyRoutes at /v1, add proxy cleanup to shutdown, add new headers to CORS exposeHeaders
├── config.ts                 # ADD: MAX_PROXY_CONCURRENT_SPAWNS, PROXY_TIMEOUT_MS
```

---

## New Endpoints

### 1. POST /v1/tools/call

Receives tool request from @seomcp/proxy, spawns fresh Rust binary per request, returns result.

**Auth:** Required (`Authorization: Bearer sk_live_REDACTED`)

**Request body (from proxy's client.ts):**
```json
{
  "tool": "gsc_performance",
  "arguments": { "site_url": "example.com", ... },
  "credentials": {
    "google_service_account": { "type": "service_account", ... },
    "gsc_property": "sc-domain:example.com",
    "ga4_property": "properties/123456"
  }
}
```

**Processing:**
1. Auth middleware validates API key (use existing `src/middleware/auth.ts`)
2. Rate limit check (use existing `src/ratelimit/` — per-user monthly)
3. Validate request body: tool name present, credentials present, SA JSON has required fields
4. Acquire slot from ConcurrencyPool (return 503 if full, 10s queue timeout)
5. Write temp credentials file to `/dev/shm/seomcp-{uuid}.json` (mode 0600)
   - File contains: `{ google_service_account, gsc_property, ga4_property }` in the format seo-mcp expects as SEO_MCP_CONFIG
6. Spawn `seo-mcp-server` binary with `SEO_MCP_CONFIG=/dev/shm/seomcp-{uuid}.json`
7. Send MCP initialize + tools/call via stdin (reuse JSON-RPC format from existing `BinaryInstance.writeMessage()`)
8. Read stdout for response
9. On success: return 200 with `{ content: [{ type: "text", text: "..." }] }`
10. On error: map to appropriate HTTP status (401/403/422/429/500)
11. Always: kill process, delete temp file, release pool slot (in `finally`)

**Response headers (all responses):**
```
X-RateLimit-Limit: {plan_limit}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {next_month_iso}
X-Min-Version: 0.1.0
```

**Error responses:** Same as Phase 1 proxy spec expectations:
- 400: Invalid request (missing tool, bad JSON)
- 401: Invalid/missing API key
- 403: Google permission error
- 422: Google API error (bad params)
- 429: Rate limit exceeded
- 500: Binary crash, spawn failure
- 503: Concurrency pool full

### 2. GET /v1/tools/manifest

Returns tool list for proxy manifest cache. **Public — no auth required.**

**Response (200):**
```json
{
  "tools": [ ... ]  // Same format as proxy's tools-manifest.json
}
```

**Source:** Use existing `src/tools-catalog.ts` to generate this. Map to MCP tools/list format.

**Headers:**
```
Cache-Control: public, max-age=3600
X-Min-Version: 0.1.0
X-Force-Update: false
```

### 3. GET /v1/auth/test

Validates API key and returns plan info. Used by `seomcp-proxy test`.

**Auth:** Required

**Response (200):**
```json
{
  "valid": true,
  "plan": "pro",
  "usage": {
    "calls_this_month": 153,
    "calls_limit": 2000,
    "reset_date": "2026-03-01"
  }
}
```

**Source:** Use existing DB queries for user plan + usage count.

### 4. GET /health (already exists)

Existing health endpoint at `src/routes/health.ts`. Add proxy spawn count:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "proxy_spawns": { "active": 3, "max": 15 }
}
```

---

## Proxy Spawner (`proxy-spawner.ts`)

Per-request binary spawner. Different from existing `BinaryPool` (which keeps long-lived processes).

```typescript
interface SpawnResult {
  ok: true;
  status: number;
  body: unknown;
} | {
  ok: false;
  status: number;
  error: string;
  code: string;
}

async function spawnForProxyRequest(
  toolName: string,
  args: Record<string, unknown>,
  credentials: {
    google_service_account: object;
    gsc_property?: string;
    ga4_property?: string;
  },
  timeoutMs: number
): Promise<SpawnResult>
```

**Key behaviors:**
1. Generate UUID for temp files
2. Write TWO temp files (both in temp dir, mode 0600):
   - `/tmp/seomcp-{uuid}-sa.json` — raw service account JSON from proxy
   - `/tmp/seomcp-{uuid}.toml` — TOML config pointing to the SA file:
     ```toml
     [credentials]
     google_service_account = "/tmp/seomcp-{uuid}-sa.json"

     [[sites]]
     name = "proxy-request"
     domain = "{extracted from gsc_property or 'unknown'}"
     gsc_property = "sc-domain:example.com"
     ga4_property_id = "properties/123456"
     ```
3. Spawn binary: `config.seoMcpBinary` with env `SEO_MCP_CONFIG=/tmp/seomcp-{uuid}.toml`
   - Temp dir: `/dev/shm` on Linux (RAM-backed), `os.tmpdir()` on macOS (dev fallback)
4. Write MCP initialize message to stdin
5. Read initialize response from stdout
6. Write tools/call message to stdin
7. Read tool result from stdout
8. Handle timeout: SIGTERM → 2s wait → SIGKILL
9. `finally`: delete temp file, kill process if still alive

**Config format (TOML — verified from Rust source `config/settings.rs`):**
```toml
[credentials]
google_service_account = "/path/to/service-account.json"

[[sites]]
name = "proxy-request"
domain = "example.com"
gsc_property = "sc-domain:example.com"
ga4_property_id = "properties/123456"
```

The `google_service_account` value is a FILE PATH to the SA JSON, not inline JSON.
This means we need TWO temp files per request (SA JSON + TOML config).

---

## Concurrency Pool (`concurrency-pool.ts`)

Simple bounded semaphore.

```typescript
class ConcurrencyPool {
  acquire(timeoutMs?: number): Promise<() => void>
  get active(): number
  get max(): number
}
```

- Default max: 15 (from config)
- Queue timeout: 10 seconds → reject with 503
- Track active count for health endpoint

---

## Config Additions (`config.ts`)

```typescript
// Add to existing config
MAX_PROXY_CONCURRENT_SPAWNS: number  // default: 15
PROXY_TIMEOUT_MS: number             // default: 30000
```

---

## Rate Limiting

Use the EXISTING rate limit infrastructure (`src/ratelimit/`).

Use existing plan limits from `src/config.ts` — do NOT duplicate values here.
Monthly limits: per-USER (not per-key). Use existing rate limit tables.
Concurrent limits: per-KEY. Track in-memory via simple `Map<string, number>` in route handler (separate from global ConcurrencyPool which prevents OOM).

---

## Security

1. **Temp credential files:** TWO files per request (SA JSON + TOML config). Written to `/dev/shm/` on Linux (RAM-backed), `os.tmpdir()` on macOS. Mode `0600`, both deleted in `finally`
2. **Request bodies never logged:** Existing structured logger already handles this — verify no new `console.log` of bodies
3. **Process cleanup:** Always kill child + delete temp file, even on server crash
4. **API key hashing:** Use existing SHA-256 approach in `src/db/`
5. **Body size limit:** Existing 1MB limit in index.ts applies

---

## Test Requirements

### New Tests
1. **POST /v1/tools/call** — valid request, missing tool, missing creds, invalid creds format, rate limited, auth failure
2. **GET /v1/tools/manifest** — returns correct format, no auth required, caching headers
3. **GET /v1/auth/test** — valid key returns plan info, invalid key returns 401
4. **Proxy spawner** — successful spawn, timeout, crash, temp file cleanup
5. **Concurrency pool** — acquire/release, queue, timeout, active count
6. **Integration** — proxy → server → mock binary → response (end-to-end)

### Use existing test patterns from `tests/` directory.

---

## Acceptance Criteria

- [ ] POST /v1/tools/call processes tool requests end-to-end
- [ ] GET /v1/tools/manifest returns 37 tools (public, cached)
- [ ] GET /v1/auth/test returns plan info
- [ ] Health endpoint includes proxy spawn count
- [ ] Rate limiting enforces plan limits
- [ ] Bounded concurrency (max 15) prevents OOM
- [ ] Temp credential files created in /dev/shm, cleaned up always
- [ ] Request bodies never logged
- [ ] All new + existing tests pass
- [ ] Server runs locally with `bun run src/index.ts`

---

## NOT in Phase 2

- Dockerfile / fly.toml / Fly.io deployment
- Cross-compilation of Rust binary
- Google OAuth flow changes
- Lemon Squeezy billing changes
- Dashboard changes
- New database schema (use existing)

---

## Deliverables

1. `src/routes/proxy.ts` — 4 new endpoints
2. `src/services/proxy-spawner.ts` — per-request spawner
3. `src/services/concurrency-pool.ts` — bounded semaphore
4. Updated `src/index.ts` — mount new routes
5. Updated `src/config.ts` — new config vars
6. Tests for all new code
7. Updated health endpoint with proxy stats
