# SEO MCP SaaS — Phase 1 Specs

**Phase:** 1 — Core API Gateway  
**Author:** Coral 🧠🔎  
**Date:** 2026-02-13  

---

## Overview

Build an HTTP API gateway that:
1. Speaks MCP Streamable HTTP (the standard remote MCP transport)
2. Authenticates via API keys
3. Rate limits per plan tier
4. Tracks usage (calls per key)
5. Proxies MCP requests to the seo-mcp Rust binary via stdio
6. Manages per-user Google OAuth tokens for GSC/GA4 access

---

## Architecture

```
┌──────────────────────┐
│  AI Client (Claude,   │
│  Cursor, etc)         │
│                       │
│  POST /mcp            │
│  Accept: text/event-  │
│    stream,            │
│    application/json   │
│  Authorization:       │
│    Bearer sk_...      │
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────────────┐
│  Hono HTTP Server (Bun)      │
│                              │
│  ┌─────────────────────────┐ │
│  │ Auth Middleware          │ │
│  │ - Validate API key      │ │
│  │ - Load user + plan      │ │
│  └─────────┬───────────────┘ │
│            ▼                 │
│  ┌─────────────────────────┐ │
│  │ Rate Limit Middleware    │ │
│  │ - Check calls remaining │ │
│  │ - Increment counter     │ │
│  └─────────┬───────────────┘ │
│            ▼                 │
│  ┌─────────────────────────┐ │
│  │ MCP Transport Layer     │ │
│  │ - Parse JSON-RPC        │ │
│  │ - Route to binary       │ │
│  │ - SSE or JSON response  │ │
│  └─────────┬───────────────┘ │
│            ▼                 │
│  ┌─────────────────────────┐ │
│  │ Binary Pool Manager     │ │
│  │ - Spawn seo-mcp binary  │ │
│  │ - Per-user config       │ │
│  │ - stdin/stdout bridge   │ │
│  └─────────────────────────┘ │
└──────────────────────────────┘
           │ stdio
           ▼
┌──────────────────────┐
│  seo-mcp-server      │
│  (Rust binary)       │
│  35 SEO tools        │
└──────────────────────┘
```

---

## File Structure

```
seo-mcp-saas/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.example
├── PLAN.md
├── SPECS.md
├── BUILD-LOG.md
├── COMPETITION-RESEARCH.md
├── src/
│   ├── index.ts                    # Entry point — starts Hono server
│   ├── config.ts                   # Environment config loader
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema (users, api_keys, usage)
│   │   ├── index.ts                # DB connection (SQLite)
│   │   └── migrate.ts              # Migration runner
│   ├── auth/
│   │   ├── middleware.ts            # API key validation middleware
│   │   └── keys.ts                 # API key generation/validation utils
│   ├── ratelimit/
│   │   └── middleware.ts            # Rate limiting middleware
│   ├── mcp/
│   │   ├── transport.ts            # MCP Streamable HTTP handler
│   │   ├── session.ts              # MCP session management
│   │   └── binary.ts               # Stdio bridge to seo-mcp binary
│   ├── usage/
│   │   └── tracker.ts              # Usage recording (per key, per tool)
│   ├── routes/
│   │   ├── mcp.ts                  # POST /mcp + GET /mcp (SSE)
│   │   ├── auth.ts                 # POST /api/auth/signup, /api/auth/login
│   │   ├── keys.ts                 # GET/POST/DELETE /api/keys
│   │   └── health.ts               # GET /health
│   └── types.ts                    # Shared TypeScript types
├── data/
│   └── seo-mcp-saas.db            # SQLite database
└── tests/
    ├── auth.test.ts
    ├── ratelimit.test.ts
    ├── mcp-transport.test.ts
    └── binary-bridge.test.ts
```

---

## Database Schema

### `users` table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (ULID) | Primary key |
| email | TEXT | Unique, not null |
| password_hash | TEXT | bcrypt hash |
| plan | TEXT | 'free' \| 'pro' \| 'agency' \| 'enterprise' |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

### `api_keys` table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (ULID) | Primary key |
| user_id | TEXT | FK → users.id |
| key_hash | TEXT | SHA-256 hash of the key |
| key_prefix | TEXT | First 8 chars (for display: `sk_live_REDACTED...`) |
| name | TEXT | User-friendly name |
| is_active | INTEGER | 1 = active, 0 = revoked |
| last_used_at | INTEGER | Unix timestamp |
| created_at | INTEGER | Unix timestamp |

### `usage_logs` table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment PK |
| api_key_id | TEXT | FK → api_keys.id |
| user_id | TEXT | FK → users.id |
| tool_name | TEXT | Which MCP tool was called |
| request_id | TEXT | JSON-RPC request ID |
| status | TEXT | 'success' \| 'error' \| 'rate_limited' |
| duration_ms | INTEGER | How long the call took |
| created_at | INTEGER | Unix timestamp |

### `rate_limits` table (in-memory, backed by SQLite for persistence)
| Column | Type | Description |
|--------|------|-------------|
| api_key_id | TEXT | FK → api_keys.id |
| window_start | INTEGER | Unix timestamp of current window start |
| call_count | INTEGER | Calls made in this window |

### `google_tokens` table (Phase 1.5 — for user Google OAuth)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (ULID) | Primary key |
| user_id | TEXT | FK → users.id |
| access_token | TEXT | Encrypted |
| refresh_token | TEXT | Encrypted |
| expires_at | INTEGER | Token expiry timestamp |
| scopes | TEXT | Comma-separated OAuth scopes |
| created_at | INTEGER | Unix timestamp |

---

## API Endpoints

### MCP Transport

#### `POST /mcp`
The main MCP endpoint per Streamable HTTP spec.

**Headers:**
- `Authorization: Bearer sk_live_...` (required)
- `Accept: application/json, text/event-stream` (required)
- `Content-Type: application/json`
- `Mcp-Session-Id: <session-id>` (required after initialization)

**Body:** JSON-RPC request(s) — single or batched

**Response:**
- For `initialize`: JSON response with `Mcp-Session-Id` header
- For tool calls: SSE stream or JSON (server decides based on expected duration)
- For notifications/responses: 202 Accepted

**Flow:**
1. Validate API key → load user + plan
2. Check rate limit → reject if exceeded (429)
3. Parse JSON-RPC → route to session manager
4. Session manager → stdio bridge → seo-mcp binary
5. Stream response back as SSE or JSON
6. Log usage

#### `GET /mcp`
Server-to-client SSE stream (for server-initiated messages).

**Headers:**
- `Authorization: Bearer sk_live_...`
- `Accept: text/event-stream`
- `Mcp-Session-Id: <session-id>`

**Response:** SSE stream (kept alive for session duration)

#### `DELETE /mcp`
Terminate an MCP session.

**Headers:**
- `Authorization: Bearer sk_live_...`
- `Mcp-Session-Id: <session-id>`

**Response:** 200 OK or 404 Not Found

### API Routes

#### `POST /api/auth/signup`
```json
{ "email": "user@example.com", "password": "..." }
```
Response: `{ "user": { "id": "...", "email": "..." }, "apiKey": "sk_live_..." }`

#### `POST /api/auth/login`
```json
{ "email": "user@example.com", "password": "..." }
```
Response: `{ "token": "jwt...", "user": { ... } }`

#### `GET /api/keys`
List user's API keys (requires JWT).

#### `POST /api/keys`
Create a new API key.
```json
{ "name": "My Agent Key" }
```
Response: `{ "key": "sk_live_...", "id": "...", "name": "..." }`
**Note:** Full key only shown once at creation.

#### `DELETE /api/keys/:id`
Revoke an API key.

#### `GET /api/usage`
Get usage stats for current billing period.
Response: `{ "used": 142, "limit": 2000, "plan": "pro", "period": "2026-02" }`

#### `GET /health`
Health check. Response: `{ "status": "ok", "version": "0.1.0" }`

---

## Plan Limits

| Plan | Calls/Month | Max Sites | Max Keys | Price |
|------|-------------|-----------|----------|-------|
| free | 50 | 1 | 1 | $0 |
| pro | 2,000 | 5 | 5 | $29/mo |
| agency | 10,000 | ∞ | 20 | $79/mo |
| enterprise | ∞ | ∞ | ∞ | $199/mo |

Rate limit window: **calendar month** (resets on 1st of each month).

---

## MCP Binary Bridge

### How it works

1. On first MCP request for a session, spawn the seo-mcp-server binary as a child process
2. Write JSON-RPC messages to its stdin
3. Read JSON-RPC responses from its stdout  
4. Each user gets their own binary instance (isolated config)
5. Binary instances are reused across requests within the same session
6. Idle instances are terminated after 5 minutes

### Per-user config

Each user's binary needs a config.toml with:
- Their Google OAuth credentials (service account or user tokens)
- Their site configurations

For MVP (Phase 1): Use a shared service account. User-specific OAuth comes in Phase 1.5.

### Spawn command
```bash
SEO_MCP_CONFIG=/tmp/seo-mcp/<user-id>/config.toml \
  /path/to/seo-mcp-server
```

### Message format (stdio)
Each message is a single line of JSON (newline-delimited).

---

## Auth Design

### API Keys
- Format: `sk_live_` + 32 random hex chars = `sk_live_REDACTED...` (40 chars total)
- Stored as SHA-256 hash in DB (never store raw key)
- Prefix `sk_live_` stored separately for key identification
- Key lookup: hash the incoming key, query by hash

### JWT (for dashboard API)
- Short-lived (1 hour)
- Contains: user_id, email, plan
- Used for /api/* routes (not for MCP — MCP uses API keys)

---

## Rate Limiting Design

- **Window:** Calendar month
- **Counter:** In-memory Map + SQLite backup
- **Check:** Before proxying each tool call (not on initialize/ping)
- **Response when exceeded:** HTTP 429 + JSON-RPC error
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Rate limit exceeded. 50/50 calls used this month. Upgrade at https://seomcp.dev/pricing"
  },
  "id": 1
}
```

---

## Error Handling

| Scenario | HTTP Status | JSON-RPC Error Code |
|----------|-------------|---------------------|
| Invalid API key | 401 | N/A (HTTP level) |
| Rate limit exceeded | 429 | -32000 |
| Invalid JSON-RPC | 400 | -32700 (parse error) |
| Method not found | 200 | -32601 |
| Binary crash | 200 | -32603 (internal error) |
| Binary timeout (30s) | 200 | -32603 |

---

## Security

1. API keys transmitted over HTTPS only
2. Keys stored as SHA-256 hashes
3. Passwords stored as bcrypt hashes
4. Rate limiting prevents abuse
5. Binary isolation per user (separate config)
6. Input validation on all endpoints
7. CORS configured for seomcp.dev only

---

## Phase 1 MVP Scope (What to build NOW)

### Must Have
- [x] Hono server with POST /mcp endpoint
- [x] API key auth middleware
- [x] Rate limiting per plan
- [x] Binary spawn + stdio bridge
- [x] MCP Streamable HTTP transport (POST for requests, SSE for streaming)
- [x] Usage tracking (per key, per tool)
- [x] Signup endpoint (email + password → API key)
- [x] Health endpoint
- [x] SQLite database with Drizzle

### Defer to Phase 1.5
- Google OAuth for user's own GSC/GA4 (use shared service account for now)
- GET /mcp (server-initiated SSE) — not needed for MVP
- Session resumability
- JWT auth for dashboard (signup returns API key directly)
- DELETE /mcp (session termination)

### Defer to Phase 2+
- Landing page
- Dashboard UI
- Billing integration
- Team/multi-user support

---

## Implementation Order

1. Project setup (package.json, tsconfig, deps)
2. Config loader (.env)
3. Database schema + migration
4. API key generation + validation
5. Auth middleware
6. Rate limit middleware
7. Binary bridge (spawn + stdio)
8. MCP transport handler (JSON-RPC parsing, SSE response)
9. POST /mcp route (wire it all together)
10. Signup route
11. Usage tracking
12. Health route
13. Tests
