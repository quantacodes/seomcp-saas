# @seomcp/proxy

Local MCP proxy for [seo-mcp](https://github.com/quantacodes/seo-mcp) — 37 SEO tools in your AI assistant.

Reads your Google service account credentials from disk and forwards MCP tool calls to `api.seomcp.dev` over HTTPS. Zero runtime dependencies, single-file bundle, ~11KB.

## Quick Start

```bash
npm i -g @seomcp/proxy
```

### Configure Your MCP Client

Add to your Claude Desktop, Cursor, or other MCP client config:

```json
{
  "mcpServers": {
    "seo": {
      "command": "seomcp-proxy",
      "env": {
        "SEOMCP_API_KEY": "sk_live_...",
        "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
        "GSC_PROPERTY": "sc-domain:example.com",
        "GA4_PROPERTY": "properties/123456"
      }
    }
  }
}
```

### Verify Setup

```bash
export SEOMCP_API_KEY="sk_live_..."
export GOOGLE_SERVICE_ACCOUNT="/path/to/service-account.json"
seomcp-proxy test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SEOMCP_API_KEY` | ✅ | API key from [seomcp.dev/dashboard](https://seomcp.dev/dashboard) |
| `GOOGLE_SERVICE_ACCOUNT` | ✅ | Path to Google service account JSON file |
| `GSC_PROPERTY` | Optional | Google Search Console property (e.g., `sc-domain:example.com`) |
| `GA4_PROPERTY` | Optional | GA4 property ID (e.g., `properties/123456`) |
| `SEOMCP_API_URL` | Optional | Override API URL (default: `https://api.seomcp.dev`) |
| `SEOMCP_TIMEOUT` | Optional | Request timeout in ms (default: `30000`) |

## CLI Commands

```bash
seomcp-proxy              # Run as MCP server (stdio mode)
seomcp-proxy test         # Validate credentials + API key + connectivity
seomcp-proxy version      # Print version
seomcp-proxy --help       # Print help
```

## 37 Tools Available

### Crawling & Audit (3)
`site_audit` · `crawl_page` · `test_robots_txt`

### Google Search Console (8)
`gsc_performance` · `gsc_list_sites` · `gsc_list_sitemaps` · `gsc_submit_sitemap` · `gsc_delete_sitemap` · `gsc_inspect_url` · `gsc_bulk_inspect` · `gsc_search_appearances`

### Google Analytics 4 (10)
`ga4_report` · `ga4_batch_report` · `ga4_funnel_report` · `ga4_realtime` · `ga4_metadata` · `ga4_overview` · `ga4_top_pages` · `ga4_traffic_sources` · `ga4_devices` · `ga4_geography`

### Core Web Vitals (1)
`core_web_vitals`

### Schema & Structured Data (2)
`validate_schema` · `analyze_robots_txt`

### Sitemaps (1)
`sitemap_index_diff`

### IndexNow (4)
`indexnow_submit_url` · `indexnow_batch_submit` · `indexnow_submit_sitemap` · `indexnow_submit_file`

### Google Indexing API (4)
`google_indexing_submit_url` · `google_indexing_batch_submit` · `google_indexing_submit_sitemap` · `google_indexing_submit_file`

### Utility (2)
`quota_status` · `healthcheck`

### Reports (1)
`generate_report`

### Meta (1)
`version`

## How It Works

```
Your AI (Claude, Cursor, etc.)
  ↕ JSON-RPC over stdio
@seomcp/proxy (this package)
  ↕ HTTPS with credentials
api.seomcp.dev
  ↕ runs seo-mcp binary
Google APIs (GSC, GA4, PageSpeed)
```

1. Your MCP client sends a `tools/call` request over stdin
2. The proxy reads your Google service account from disk (fresh every call)
3. Forwards the tool call + credentials to `api.seomcp.dev` over HTTPS
4. Returns the result to your MCP client over stdout

**Credentials are re-read on every request** — rotate your service account keys without restarting.

## Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a service account (or use existing)
3. Enable APIs: Search Console API, Analytics Data API, PageSpeed Insights API
4. Download the JSON key file
5. Share your GSC property with the service account email (Viewer role)
6. Add the service account to your GA4 property (Viewer role)

## Security

- Credentials are transmitted over HTTPS only
- Service account JSON is re-read from disk per request (never cached in memory)
- API key validated locally before any network call
- The cloud API does not log or persist credentials

## Requirements

- Node.js ≥ 18
- Google service account with GSC/GA4 access
- API key from [seomcp.dev](https://seomcp.dev)

## License

MIT © [quantacodes](https://github.com/quantacodes)
