/**
 * Tool catalog — structured data for all 35 seo-mcp tools.
 * Used by the /tools page and the OpenAPI spec.
 */

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  categoryIcon: string;
  params: { name: string; type: string; required: boolean; description: string }[];
  example?: string;
  tier: "free" | "all"; // "free" = works without Google OAuth
}

export const TOOL_CATEGORIES = [
  { id: "reports", name: "Reports", icon: "📋", description: "One-command full SEO audits" },
  { id: "crawl", name: "Crawling & Audit", icon: "🔍", description: "Crawl pages, test robots, find issues" },
  { id: "gsc", name: "Google Search Console", icon: "📊", description: "Search performance, indexing, sitemaps" },
  { id: "indexing", name: "Google Indexing API", icon: "📨", description: "Submit URLs to Google for immediate indexing" },
  { id: "ga4", name: "Google Analytics 4", icon: "📈", description: "Traffic, engagement, conversions" },
  { id: "cwv", name: "Core Web Vitals", icon: "⚡", description: "PageSpeed, LCP, INP, CLS scores" },
  { id: "schema", name: "Schema & Structured Data", icon: "🏗️", description: "JSON-LD validation & robots.txt analysis" },
  { id: "sitemaps", name: "Sitemaps", icon: "🗺️", description: "Sitemap analysis & GSC diff" },
  { id: "indexnow", name: "IndexNow", icon: "🚀", description: "Submit URLs for instant indexing" },
  { id: "meta", name: "System", icon: "ℹ️", description: "Version & server info" },
] as const;

export const TOOLS: ToolInfo[] = [
  // Reports
  {
    name: "generate_report",
    description: "One-command full SEO report — 16 sections, health score 0-100, prioritized recommendations",
    category: "reports",
    categoryIcon: "📋",
    params: [
      { name: "site_url", type: "string", required: true, description: "Domain to audit (e.g. example.com)" },
    ],
    example: '{"name": "generate_report", "arguments": {"site_url": "example.com"}}',
    tier: "all",
  },

  // Crawling
  {
    name: "site_audit",
    description: "Crawl site and find issues — missing titles, meta, headings, broken images, bad links",
    category: "crawl",
    categoryIcon: "🔍",
    params: [
      { name: "start_url", type: "string", required: true, description: "URL to start crawling" },
      { name: "max_pages", type: "number", required: false, description: "Max pages to crawl (default 50)" },
    ],
    example: '{"name": "site_audit", "arguments": {"start_url": "https://example.com", "max_pages": 20}}',
    tier: "free",
  },
  {
    name: "crawl_page",
    description: "Deep-crawl a single page — HTML analysis, schema detection, headers, links, images, performance",
    category: "crawl",
    categoryIcon: "🔍",
    params: [
      { name: "url", type: "string", required: true, description: "Page URL to crawl" },
    ],
    tier: "free",
  },
  {
    name: "test_robots_txt",
    description: "Test if a URL is allowed or blocked by robots.txt for a specific user agent",
    category: "crawl",
    categoryIcon: "🔍",
    params: [
      { name: "site_url", type: "string", required: true, description: "Site base URL" },
      { name: "test_url", type: "string", required: true, description: "URL to test" },
      { name: "user_agent", type: "string", required: false, description: "User agent to test as (default: Googlebot)" },
    ],
    tier: "free",
  },

  // GSC
  {
    name: "gsc_performance",
    description: "Search performance data — queries, pages, devices, countries with clicks, impressions, CTR, position",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "start_date", type: "string", required: true, description: "Start date (YYYY-MM-DD)" },
      { name: "end_date", type: "string", required: true, description: "End date (YYYY-MM-DD)" },
      { name: "dimensions", type: "string[]", required: false, description: "Dimensions: query, page, device, country, date" },
      { name: "row_limit", type: "number", required: false, description: "Max rows (default 10, max 25000)" },
    ],
    tier: "all",
  },
  {
    name: "gsc_list_sites",
    description: "List all verified Google Search Console properties",
    category: "gsc",
    categoryIcon: "📊",
    params: [],
    tier: "all",
  },
  {
    name: "gsc_list_sitemaps",
    description: "List all submitted sitemaps for a property",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
    ],
    tier: "all",
  },
  {
    name: "gsc_submit_sitemap",
    description: "Submit a sitemap URL to Google Search Console",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "sitemap_url", type: "string", required: true, description: "Sitemap URL" },
    ],
    tier: "all",
  },
  {
    name: "gsc_delete_sitemap",
    description: "Remove a submitted sitemap from Google Search Console",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "sitemap_url", type: "string", required: true, description: "Sitemap URL to remove" },
    ],
    tier: "all",
  },
  {
    name: "gsc_inspect_url",
    description: "Inspect a URL's indexing status, coverage, mobile usability, and rich results",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "url", type: "string", required: true, description: "URL to inspect" },
    ],
    tier: "all",
  },
  {
    name: "gsc_bulk_inspect",
    description: "Inspect multiple URLs at once (sequential, rate-limited to respect Google's API)",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "urls", type: "string[]", required: true, description: "URLs to inspect" },
    ],
    tier: "all",
  },
  {
    name: "gsc_search_appearances",
    description: "Rich result type breakdown — FAQ, Event, HowTo, Review, Product appearances in search",
    category: "gsc",
    categoryIcon: "📊",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "start_date", type: "string", required: true, description: "Start date (YYYY-MM-DD)" },
      { name: "end_date", type: "string", required: true, description: "End date (YYYY-MM-DD)" },
    ],
    tier: "all",
  },

  // Google Indexing API
  {
    name: "google_indexing_submit_url",
    description: "Submit a URL to Google for immediate indexing. The URL must belong to a verified Search Console property.",
    category: "indexing",
    categoryIcon: "📨",
    params: [
      { name: "url", type: "string", required: true, description: "URL to submit" },
      { name: "notification_type", type: "string", required: false, description: "URL_UPDATED or URL_DELETED (default: URL_UPDATED)" },
    ],
    tier: "all",
  },
  {
    name: "google_indexing_batch_submit",
    description: "Submit multiple URLs to Google for indexing (max 100 URLs per batch). Use dry_run=true to preview.",
    category: "indexing",
    categoryIcon: "📨",
    params: [
      { name: "urls", type: "string[]", required: true, description: "URLs to submit (max 100)" },
      { name: "notification_type", type: "string", required: false, description: "URL_UPDATED or URL_DELETED" },
      { name: "dry_run", type: "boolean", required: false, description: "Preview without submitting" },
    ],
    tier: "all",
  },
  {
    name: "google_indexing_submit_sitemap",
    description: "Fetch a sitemap.xml and submit all URLs to Google for indexing (max 100 URLs).",
    category: "indexing",
    categoryIcon: "📨",
    params: [
      { name: "sitemap_url", type: "string", required: true, description: "Sitemap URL" },
      { name: "max_urls", type: "number", required: false, description: "Max URLs to submit (default 100)" },
    ],
    tier: "all",
  },
  {
    name: "google_indexing_submit_file",
    description: "Read URLs from a local file (txt/csv) and submit to Google for indexing (max 100 URLs).",
    category: "indexing",
    categoryIcon: "📨",
    params: [
      { name: "file_path", type: "string", required: true, description: "Path to URL list file" },
      { name: "max_urls", type: "number", required: false, description: "Max URLs to submit (default 100)" },
    ],
    tier: "all",
  },

  // GA4
  {
    name: "ga4_list_properties",
    description: "List all GA4 properties accessible to the service account — use this to discover properties before running reports",
    category: "ga4",
    categoryIcon: "📈",
    params: [],
    tier: "all",
  },
  {
    name: "validate_properties",
    description: "Validate GSC and GA4 property configuration — diagnose setup issues and get helpful fix instructions",
    category: "utility",
    categoryIcon: "🔧",
    params: [],
    tier: "all",
  },
  {
    name: "ga4_report",
    description: "Universal GA4 report — 5 presets (channels, landing_pages, engagement, content, conversions) + full custom mode",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID or domain name" },
      { name: "start_date", type: "string", required: true, description: "Start date (YYYY-MM-DD)" },
      { name: "end_date", type: "string", required: true, description: "End date (YYYY-MM-DD)" },
      { name: "preset", type: "string", required: false, description: "Preset: channels, landing_pages, engagement, content, conversions" },
      { name: "dimensions", type: "string[]", required: false, description: "Custom dimensions (custom mode only)" },
      { name: "metrics", type: "string[]", required: false, description: "Custom metrics (custom mode only)" },
      { name: "limit", type: "number", required: false, description: "Max rows (default 10)" },
    ],
    tier: "all",
  },
  {
    name: "ga4_realtime",
    description: "Real-time active users right now",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID or domain name" },
    ],
    tier: "all",
  },
  {
    name: "ga4_metadata",
    description: "Discover all available dimensions and metrics for a GA4 property",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID or domain name" },
    ],
    tier: "all",
  },
  {
    name: "ga4_overview",
    description: "Quick summary — sessions, users, pageviews, bounce rate, avg duration",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID" },
      { name: "start_date", type: "string", required: true, description: "Start date" },
      { name: "end_date", type: "string", required: true, description: "End date" },
    ],
    tier: "all",
  },
  {
    name: "ga4_top_pages",
    description: "Top pages by pageviews with engagement metrics",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID" },
      { name: "start_date", type: "string", required: true, description: "Start date" },
      { name: "end_date", type: "string", required: true, description: "End date" },
      { name: "limit", type: "number", required: false, description: "Max rows" },
    ],
    tier: "all",
  },
  {
    name: "ga4_traffic_sources",
    description: "Traffic breakdown by channel and source/medium",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID" },
      { name: "start_date", type: "string", required: true, description: "Start date" },
      { name: "end_date", type: "string", required: true, description: "End date" },
    ],
    tier: "all",
  },
  {
    name: "ga4_devices",
    description: "Device category, browser, and OS breakdown",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID" },
      { name: "start_date", type: "string", required: true, description: "Start date" },
      { name: "end_date", type: "string", required: true, description: "End date" },
    ],
    tier: "all",
  },
  {
    name: "ga4_geography",
    description: "Traffic breakdown by country and city",
    category: "ga4",
    categoryIcon: "📈",
    params: [
      { name: "property_id", type: "string", required: true, description: "GA4 property ID" },
      { name: "start_date", type: "string", required: true, description: "Start date" },
      { name: "end_date", type: "string", required: true, description: "End date" },
    ],
    tier: "all",
  },

  // CWV
  {
    name: "core_web_vitals",
    description: "PageSpeed Insights — LCP, INP, CLS, FCP, TTFB, total blocking time, performance score 0-100",
    category: "cwv",
    categoryIcon: "⚡",
    params: [
      { name: "url", type: "string", required: true, description: "URL to test" },
      { name: "strategy", type: "string", required: false, description: "mobile or desktop (default: mobile)" },
    ],
    example: '{"name": "core_web_vitals", "arguments": {"url": "https://example.com", "strategy": "mobile"}}',
    tier: "free",
  },

  // Schema
  {
    name: "validate_schema",
    description: "Validate JSON-LD structured data — type detection, required field validation, @graph support",
    category: "schema",
    categoryIcon: "🏗️",
    params: [
      { name: "url", type: "string", required: false, description: "URL to extract and validate schema from" },
      { name: "schema", type: "string", required: false, description: "Raw JSON-LD to validate (alternative to url)" },
    ],
    tier: "free",
  },
  {
    name: "analyze_robots_txt",
    description: "Parse and analyze robots.txt — rules per user-agent, sitemaps, crawl-delay directives",
    category: "schema",
    categoryIcon: "🏗️",
    params: [
      { name: "site_url", type: "string", required: true, description: "Site URL" },
    ],
    tier: "free",
  },

  // Sitemaps
  {
    name: "sitemap_index_diff",
    description: "Compare sitemap URLs against GSC indexed URLs — find gaps between submitted and indexed",
    category: "sitemaps",
    categoryIcon: "🗺️",
    params: [
      { name: "site_url", type: "string", required: true, description: "GSC property URL" },
      { name: "sitemap_url", type: "string", required: true, description: "Sitemap URL to analyze" },
      { name: "max_urls", type: "number", required: false, description: "Max URLs to check" },
    ],
    tier: "all",
  },

  // IndexNow
  {
    name: "indexnow_submit_url",
    description: "Submit a single URL for faster search engine indexing via IndexNow protocol. API key auto-resolved from server config.",
    category: "indexnow",
    categoryIcon: "🚀",
    params: [
      { name: "url", type: "string", required: true, description: "Fully-qualified URL to submit" },
      { name: "dry_run", type: "boolean", required: false, description: "Validate URL and config without actually submitting" },
    ],
    tier: "free",
  },
  {
    name: "indexnow_batch_submit",
    description: "Submit multiple URLs at once for faster indexing (max 10,000). All URLs must belong to the same host. API key auto-resolved.",
    category: "indexnow",
    categoryIcon: "🚀",
    params: [
      { name: "urls", type: "string[]", required: true, description: "URLs to submit (max 10,000)" },
      { name: "host", type: "string", required: false, description: "Host domain (auto-extracted from first URL if omitted)" },
      { name: "dry_run", type: "boolean", required: false, description: "Validate URLs without submitting" },
    ],
    tier: "free",
  },
  {
    name: "indexnow_submit_sitemap",
    description: "Parse a sitemap and submit all URLs via IndexNow. API key auto-resolved.",
    category: "indexnow",
    categoryIcon: "🚀",
    params: [
      { name: "sitemap_url", type: "string", required: true, description: "Sitemap URL to parse" },
      { name: "max_urls", type: "number", required: false, description: "Max URLs to submit (default: 10,000, max: 10,000)" },
      { name: "dry_run", type: "boolean", required: false, description: "Preview what would be submitted without actually submitting" },
    ],
    tier: "free",
  },
  {
    name: "indexnow_submit_file",
    description: "Submit URLs from a text file (one URL per line). API key auto-resolved.",
    category: "indexnow",
    categoryIcon: "🚀",
    params: [
      { name: "file_path", type: "string", required: true, description: "Path to URL list file" },
      { name: "dry_run", type: "boolean", required: false, description: "Preview what would be submitted without actually submitting" },
    ],
    tier: "free",
  },

  // Meta
  {
    name: "quota_status",
    description: "Check API quota status: Google Indexing (200/day per property) and GSC rate limit (1,200/minute)",
    category: "meta",
    categoryIcon: "ℹ️",
    params: [],
    tier: "all",
  },
  {
    name: "healthcheck",
    description: "Check server health, version, uptime, and configuration status",
    category: "meta",
    categoryIcon: "ℹ️",
    params: [],
    tier: "free",
  },
  {
    name: "version",
    description: "Server version, tool count, uptime, and architecture info",
    category: "meta",
    categoryIcon: "ℹ️",
    params: [],
    tier: "free",
  },
];

// Counts
export const TOOL_COUNT = TOOLS.length;
export const FREE_TOOLS = TOOLS.filter(t => t.tier === "free").length;
export const GOOGLE_TOOLS = TOOLS.filter(t => t.tier === "all").length;
