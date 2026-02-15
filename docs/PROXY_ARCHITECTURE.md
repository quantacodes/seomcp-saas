# Proxy Architecture

The `proxy/` directory contains a **separate npm package** (`@seomcp/proxy`) that customers install locally on their machines. It is not part of the backend — it is the client-side bridge between their AI assistant and your API.

## Overview

```
┌─────────────────┐     stdin/stdout      ┌─────────────┐     HTTPS      ┌─────────────────┐
│   Claude,       │ ◄─── JSON-RPC ─────►  │  seomcp-    │ ◄───────────► │  api.seomcp.dev │
│   Cursor, etc.  │      (MCP protocol)   │  proxy      │   (your API)  │  (your backend) │
└─────────────────┘                       └─────────────┘               └─────────────────┘
                                                 │
                                                 ▼
                                        Reads Google service
                                        account from disk
```

## Why It Exists

| Problem | Solution |
|---------|----------|
| **Security** | Google service account never leaves user's machine unencrypted |
| **Key rotation** | Credentials re-read from disk on every call (no caching) |
| **Zero runtime deps** | Single ~11KB file, no npm install hell |
| **Protocol bridge** | Translates MCP JSON-RPC ↔ HTTPS REST |

## Data Flow

1. **Claude/Cursor** sends `tools/call` request over stdin (MCP protocol)
2. **seomcp-proxy** reads Google service account JSON from disk (fresh every call)
3. **seomcp-proxy** forwards to `api.seomcp.dev/v1/tools/call` over HTTPS with:
   - API key in header: `Authorization: Bearer sk_live_...`
   - Credentials in request body
   - Proxy version header: `X-Proxy-Version`
4. **Your backend** uses credentials to call Google APIs (GSC, GA4, PageSpeed)
5. **Result** flows back through proxy to Claude as MCP-compatible response

## Customer Setup

```bash
npm i -g @seomcp/proxy
```

Add to Claude Desktop or Cursor config:

```json
{
  "mcpServers": {
    "seo": {
      "command": "seomcp-proxy",
      "env": {
        "SEOMCP_API_KEY": "sk_live_...",
        "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
        "GSC_PROPERTIES": "example.com,blog.example.com",
        "GA4_PROPERTIES": "123:example.com,456:blog.example.com"
      }
    }
  }
}
```

## Key Components

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point, handles commands (test, version, help) |
| `src/mcp.ts` | MCP JSON-RPC server over stdin/stdout |
| `src/client.ts` | HTTPS client to your cloud API |
| `src/credentials.ts` | Reads Google service account from disk |
| `src/manifest.ts` | Caches tool list from cloud |
| `src/errors.ts` | MCP-compatible error responses |
| `src/version.ts` | Version checking and force updates |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SEOMCP_API_KEY` | ✅ | API key from seomcp.dev/dashboard |
| `GOOGLE_SERVICE_ACCOUNT` | ✅ | Path to Google service account JSON file |
| `GSC_PROPERTIES` | Required for GSC | Comma-separated domain names (e.g., `example.com,blog.example.com`) |
| `GA4_PROPERTIES` | Required for GA4 | Comma-separated `propertyID:domain` (e.g., `123:example.com,456:blog.example.com`) |
| `SEOMCP_API_URL` | Optional | Override API URL (default: `https://api.seomcp.dev`) |
| `SEOMCP_TIMEOUT` | Optional | Request timeout in ms (default: `30000`) |

**Property Format:**
- `GSC_PROPERTIES`: Just domain names - we auto-add `sc-domain:` prefix
- `GA4_PROPERTIES`: Use `propertyID:domain` for explicit mapping between GA4 and GSC

Example:
```
GSC_PROPERTIES=example.com,blog.example.com
GA4_PROPERTIES=123456789:example.com,987654321:blog.example.com
```

## CLI Commands

```bash
seomcp-proxy              # Run as MCP server (stdio mode)
seomcp-proxy test         # Validate credentials + API key + connectivity
seomcp-proxy version      # Print version
seomcp-proxy --help       # Print help
```

## Security Model

- **Credentials stay local**: Google service account JSON is read from disk per request, never cached in memory
- **HTTPS only**: All communication to cloud is encrypted
- **API key validation**: Checked locally before any network call
- **Cloud does not persist credentials**: They are used once and discarded

## MCP Protocol Support

The proxy implements the Model Context Protocol (MCP) over stdio:

| Method | Handler | Description |
|--------|---------|-------------|
| `initialize` | `handleInitialize` | Server capabilities handshake |
| `tools/list` | `handleToolsList` | Returns available tools from manifest |
| `tools/call` | `handleToolsCall` | Forwards tool call to cloud API |
| `notifications/initialized` | Silent | Client initialized notification |
| `notifications/cancelled` | Silent | Request cancelled notification |

## Error Handling

The proxy maps various error conditions to MCP-compatible error responses:

- **Missing API key** → `-32001` Invalid Request
- **Invalid API key** → `-32001` Invalid Request  
- **Missing credentials** → `-32002` Credentials Missing
- **Invalid credentials** → `-32003` Credentials Invalid
- **Permission denied** → `-32004` Permission Denied (suggests adding service account to GSC/GA4)
- **Rate limited** → `-32005` Rate Limited (includes remaining quota)
- **Server error** → `-32603` Internal Error
- **Timeout** → `-32006` Request Timeout

## Version Management

The proxy checks version headers from the cloud API on every response. If the cloud indicates the proxy is outdated, it can force an update by blocking all tool calls until the user upgrades.

---

## Summary

- ✅ **NOT** a direct connection from local model → your server
- ✅ **IS** a proxy that: (a) speaks MCP protocol to Claude, (b) forwards to your API over HTTPS
- ✅ Keeps customer Google credentials on their machine only
- ✅ Validates API key before any network call
- ✅ Zero runtime dependencies, single-file bundle (~11KB)
