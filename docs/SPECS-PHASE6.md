# Phase 6: Audit History, Key Scoping, Changelog, Social Meta

## 6A: Audit History

### Overview
Automatically capture `generate_report` and `site_audit` results. Store health scores, key metrics, and full report data so users can track SEO health over time.

### Database Schema

```sql
CREATE TABLE audit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  api_key_id TEXT NOT NULL REFERENCES api_keys(id),
  tool_name TEXT NOT NULL, -- 'generate_report' | 'site_audit' | 'crawl_page'
  site_url TEXT NOT NULL, -- Domain/URL that was audited
  health_score INTEGER, -- 0-100 (from generate_report)
  summary TEXT, -- JSON: extracted key metrics
  full_result TEXT NOT NULL, -- Full tool response JSON (compressed)
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_history_user ON audit_history(user_id, created_at DESC);
CREATE INDEX idx_audit_history_site ON audit_history(user_id, site_url, created_at DESC);
```

### Captured Tools
- `generate_report` → extract health_score, store full report
- `site_audit` → extract stats, store full crawl data
- `crawl_page` → extract page stats, store full result

### Summary Fields (JSON)
For `generate_report`:
```json
{
  "healthScore": 87,
  "totalPages": 150,
  "issuesFound": 12,
  "cwv": { "lcp": 1.2, "fid": 50, "cls": 0.05 },
  "indexedPages": 120,
  "topQuery": "best seo tools"
}
```

### Transport Integration
In `handleRequest()`, after a successful tool call for captured tools:
1. Extract the tool name from request params
2. If tool is in CAPTURED_TOOLS set, extract metrics
3. Store in audit_history table (fire-and-forget, don't block response)

### Dashboard API
- `GET /dashboard/api/audits` — List audit history (paginated, filterable by site)
- `GET /dashboard/api/audits/:id` — Get full audit result
- `GET /dashboard/api/audits/sites` — List unique sites with latest scores

### Dashboard UI
New "Audit History" tab in dashboard:
- Site selector dropdown
- Timeline chart of health scores
- List of past audits with date, score, key metrics
- Click to expand full report

### Plan Limits
- Free: 7-day retention, last 10 audits
- Pro: 30-day retention, last 100 audits
- Agency: 90-day retention, last 1000 audits

---

## 6B: Key Scoping

### Overview
Allow API keys to be restricted to specific tool categories. Agencies can create read-only keys (GSC data only) or action-only keys (IndexNow only).

### Tool Categories
```typescript
const TOOL_CATEGORIES = {
  crawl: ['site_audit', 'crawl_page', 'test_robots_txt'],
  gsc: ['gsc_performance', 'gsc_list_sites', 'gsc_list_sitemaps', 'gsc_submit_sitemap', 'gsc_delete_sitemap', 'gsc_inspect_url', 'gsc_bulk_inspect', 'gsc_search_appearances'],
  ga4: ['ga4_report', 'ga4_realtime', 'ga4_metadata', 'ga4_overview', 'ga4_top_pages', 'ga4_traffic_sources', 'ga4_devices', 'ga4_geography'],
  schema: ['validate_schema', 'analyze_robots_txt'],
  indexnow: ['indexnow_submit_url', 'indexnow_batch_submit', 'indexnow_submit_sitemap', 'indexnow_submit_file'],
  report: ['generate_report'],
  meta: ['version'],
} as const;
```

### Database Change
Add `scopes` column to `api_keys`:
```sql
ALTER TABLE api_keys ADD COLUMN scopes TEXT DEFAULT NULL;
-- NULL = all tools allowed (backwards compatible)
-- JSON array: ["crawl", "gsc", "report"] 
```

### Auth Flow
1. Key creation: optionally pass `scopes: ["crawl", "gsc"]`
2. On tool call: check if tool is in allowed categories
3. If not allowed: return 403 with message about key scope

### Dashboard UI
When creating a key, show checkboxes for tool categories.
When viewing keys, show scope badges.

---

## 6C: Changelog Page

### Route: GET /changelog

A simple markdown-rendered changelog page showing product updates.
Same dark theme as rest of site. Entries stored in a const array.

### Entries
```typescript
const entries = [
  {
    date: '2026-02-13',
    version: 'v0.1.0',
    title: 'Initial Launch',
    items: [
      'All 35 SEO tools available via MCP',
      'API key authentication + rate limiting',
      'Google OAuth for GSC + GA4 access',
      'Interactive playground — try 3 tools without signup',
      'Dashboard with usage stats and API key management',
      'Lemon Squeezy billing integration',
      'Full API documentation',
    ],
  },
];
```

---

## 6D: Social Meta / OG Tags

### Per-page OG + Twitter cards

Each HTML-serving route adds:
```html
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="https://seomcp.dev/...">
<meta property="og:type" content="website">
<meta property="og:image" content="https://seomcp.dev/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
```

Pages: landing, docs, tools, playground, changelog, pricing, terms, privacy
