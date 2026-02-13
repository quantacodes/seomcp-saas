# Phase 1 Spec: @seomcp/proxy (npm package)

**Priority:** P0 — Day 1 Build
**Assignee:** Chitin (Developer)
**Reviewer:** Barnacle (Code Review)
**QA:** Reef (Testing)

---

## Overview

Build a lightweight npm package (`@seomcp/proxy`) that acts as a LOCAL stdio MCP server. It reads Google service account credentials from the user's filesystem and forwards MCP tool requests to our cloud API (`api.seomcp.dev`) over HTTPS.

This is the user-facing client. It must be:
- Tiny (~200-300 lines max)
- Zero dependencies (or absolute minimum)
- Bulletproof error handling
- Open source quality code

---

## Technical Requirements

### Package Structure
```
@seomcp/proxy/
├── package.json
├── README.md
├── LICENSE (MIT)
├── bin/
│   └── seomcp-proxy.js          # CLI entrypoint (chmod +x)
├── src/
│   ├── index.ts                  # Main proxy logic
│   ├── mcp.ts                    # MCP JSON-RPC stdio handler
│   ├── credentials.ts            # Google cred reader + validator
│   ├── client.ts                 # HTTPS client to api.seomcp.dev
│   ├── manifest.ts               # Cached tool manifest
│   ├── errors.ts                 # Error taxonomy
│   └── version.ts                # Version check
├── test/
│   ├── proxy.test.ts             # Core proxy tests
│   ├── credentials.test.ts       # Cred validation tests
│   ├── mcp.test.ts               # JSON-RPC protocol tests
│   └── errors.test.ts            # Error handling tests
└── tsconfig.json
```

### Environment Variables (read from MCP client config)
```
SEOMCP_API_KEY        (required) — API key for authentication (sk-xxx format)
GOOGLE_SERVICE_ACCOUNT (required) — Path to Google service account JSON file
GSC_PROPERTY          (optional) — Google Search Console property (e.g., sc-domain:example.com)
GA4_PROPERTY          (optional) — GA4 property ID (e.g., properties/123456)
SEOMCP_API_URL        (optional) — Override API URL (default: https://api.seomcp.dev)
SEOMCP_TIMEOUT        (optional) — Request timeout in ms (default: 30000)
```

### Core Behaviors

#### 1. Stdio MCP Server (JSON-RPC)
- Read JSON-RPC messages from stdin using **newline-delimited JSON** (one JSON object per line)
  - NOTE: Some MCP clients use Content-Length framing (LSP-style). Test against Claude Desktop and Cursor to confirm which framing they use. If Content-Length is required, implement that instead. Verify before committing.
- Write JSON-RPC responses to stdout (same framing as input)
- Handle MCP lifecycle: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`
- **`initialize`**: Return server info (name: "seomcp-proxy", version: from package.json)
- **`tools/list`**: Serve CACHED tool manifest (fetched once on startup from cloud, or bundled fallback)
- **`tools/call`**: Forward to cloud API with credentials attached

#### 2. Credential Reading
- On startup: read `GOOGLE_SERVICE_ACCOUNT` file path
- Validate JSON structure: must have `type`, `project_id`, `private_key_id`, `private_key`, `client_email`
- If invalid: write MCP error to stdout and exit with code 1
- Re-read file on EVERY request (supports key rotation without restart)
- Never cache the actual credential content in memory longer than the request

#### 3. Cloud API Client
- POST to `{SEOMCP_API_URL}/v1/tools/call`
- Headers:
  ```
  Authorization: Bearer {SEOMCP_API_KEY}
  Content-Type: application/json
  X-Proxy-Version: {package version}
  ```
- Body:
  ```json
  {
    "tool": "tool_name",
    "arguments": { ... },
    "credentials": {
      "google_service_account": { ... full JSON ... },
      "gsc_property": "sc-domain:example.com",
      "ga4_property": "properties/123456"
    }
  }
  ```
- Timeout: 30 seconds (configurable via SEOMCP_TIMEOUT)
- Retry: NO retries for tool calls (credentials in body — don't re-transmit unnecessarily)
- Retry: YES for `tools/list` manifest fetch (3 retries with exponential backoff)

#### 4. Tool Manifest Caching
- On startup: fetch manifest from `GET {SEOMCP_API_URL}/v1/tools/manifest`
  - **Auth:** Optional — endpoint is public (tool list is not sensitive)
  - **Response format:** Standard MCP `tools/list` result shape:
    ```json
    {
      "tools": [
        {
          "name": "gsc_performance",
          "description": "Get Google Search Console performance data",
          "inputSchema": { "type": "object", "properties": { ... }, "required": [...] }
        },
        ...
      ]
    }
    ```
  - Response headers may include `X-Min-Version` and `X-Force-Update`
- Cache in memory for the lifetime of the process
- If fetch fails: use bundled fallback manifest (same schema, hardcoded array of 35 tools with name + description + inputSchema, compiled into the bundle at build time from a `tools-manifest.json` file)
- Serve `tools/list` from cache (never round-trip to cloud for schema requests)

#### 5. Error Handling
Error taxonomy — every error returns structured JSON-RPC error:

| Error Code | Meaning | Message |
|-----------|---------|---------|
| -32600 | Invalid request | "Invalid JSON-RPC request" |
| -32601 | Method not found | "Unknown method: {method}" |
| -32001 | Missing credentials | "GOOGLE_SERVICE_ACCOUNT not set or file not found" |
| -32002 | Invalid credentials | "Service account JSON is malformed: missing {field}" |
| -32003 | API key missing | "SEOMCP_API_KEY not set" |
| -32004 | API key invalid | "Invalid API key. Check your key at seomcp.dev/dashboard" |
| -32005 | Rate limited | "Rate limit exceeded. {remaining} calls remaining. Upgrade at seomcp.dev/pricing" |
| -32006 | Cloud unreachable | "Cannot reach api.seomcp.dev. Check your internet connection" |
| -32007 | Request timeout | "Request timed out after {timeout}ms" |
| -32008 | Google API error | "Google API error: {message}" |
| -32009 | Server error | "seomcp.dev server error. Try again later" |
| -32010 | Version outdated | "Proxy version {current} is outdated. Run: npm i -g @seomcp/proxy" |
| -32011 | Permission denied | "Service account lacks access to {property}. Share {client_email} in Google Search Console" |

#### 6. Graceful Shutdown
- stdin EOF (client disconnects) → cancel in-flight requests, exit code 0
- SIGTERM/SIGINT → cancel in-flight requests, exit code 0
- Don't leave dangling cloud requests — use AbortController on fetch

#### 7. API Key Format
- Format: `sk_live_` prefix + 32 hex characters (e.g., `sk_live_REDACTED...`)
- Validate format locally before any network call (fail fast with -32003)
- Regex: `/^sk_live_[a-f0-9]{32}$/`

#### 8. Version Check
- On startup: send `X-Proxy-Version` header with manifest fetch
- If cloud responds with `X-Min-Version` header and current < min: print warning to stderr
- If cloud responds with `X-Force-Update: true`: refuse to process requests, print update instructions to stderr, return error for all tool calls
- Never block startup for version check (non-blocking, best-effort)

#### 7. CLI Commands
```bash
seomcp-proxy              # Run as MCP server (default, stdio mode)
seomcp-proxy test         # Validate creds + API key + connectivity
seomcp-proxy version      # Print version
seomcp-proxy --help       # Print help
```

**`seomcp-proxy test`** should:
1. Check SEOMCP_API_KEY is set
2. Check GOOGLE_SERVICE_ACCOUNT file exists and is valid JSON
3. Validate service account JSON structure
4. Ping api.seomcp.dev/health
5. Make a test auth call to validate API key
6. Print results with ✅/❌ for each check
7. Exit 0 if all pass, 1 if any fail

### Security: Credential Transmission
- Google service account private key is transmitted in every `tools/call` request body over HTTPS
- This is an acceptable Phase 1 tradeoff (service account keys are rotatable)
- **CLOUD API REQUIREMENTS (enforced server-side):**
  - MUST NOT log request bodies containing credentials
  - MUST NOT persist credentials beyond the request lifecycle
  - MUST pass creds to Rust binary via stdin pipe (not env vars)
  - MUST kill process after response (creds gone from memory)
- Phase 2 optimization: proxy sends hash of service account email as identifier, cloud caches full creds server-side after first use (reduces per-request credential transmission)

---

### Non-Goals (NOT in Phase 1)
- OAuth flow (Phase 7)
- Interactive setup wizard `seomcp-proxy init` (Phase 7)
- Auto-update
- Batched multi-tool requests
- Any UI or dashboard

---

## Build Constraints

- **Language:** TypeScript, compiled to single JS file with esbuild/bun build
- **Dependencies:** ZERO runtime deps if possible. Use Node.js built-ins only (https, fs, readline, process)
- **Node version:** >=18 (for native fetch and built-in test runner)
- **Package size:** <50KB published
- **Binary:** Single executable via `bin` field in package.json

---

## Test Requirements

Minimum test coverage:

1. **JSON-RPC Protocol**
   - Valid initialize → returns capabilities
   - Valid tools/list → returns cached manifest
   - Valid tools/call → forwards to cloud, returns result
   - Invalid JSON → returns -32600
   - Unknown method → returns -32601
   - Missing params → appropriate error

2. **Credentials**
   - Valid service account JSON → passes validation
   - Missing file → -32001 error
   - Malformed JSON → -32002 error with specific missing field
   - Missing required fields → -32002 with field name

3. **Cloud Client**
   - Successful request → returns tool result
   - 401 response → -32004 error
   - 429 response → -32005 with remaining quota
   - Timeout → -32007 error
   - Network error → -32006 error
   - 500 response → -32009 error

4. **Version Check**
   - Outdated version warning → prints to stderr, continues
   - Force update → blocks requests, returns -32010

5. **CLI Commands**
   - `test` subcommand validates all checks
   - `version` prints version
   - `--help` prints usage
   - Default runs stdio server

---

## Acceptance Criteria

- [ ] `npm i -g @seomcp/proxy` installs cleanly
- [ ] `seomcp-proxy` starts and accepts JSON-RPC on stdin
- [ ] `tools/list` returns 35 tools from cache (no cloud round-trip)
- [ ] `tools/call` forwards to cloud with creds, returns result
- [ ] All error codes return structured JSON-RPC errors
- [ ] `seomcp-proxy test` validates full chain
- [ ] Zero runtime dependencies
- [ ] <50KB package size
- [ ] All tests pass
- [ ] Code is open-source quality (clean, documented, no secrets)

---

## Deliverables

1. Complete npm package source code
2. All tests passing
3. README.md with setup instructions
4. Built/bundled JS ready for npm publish
