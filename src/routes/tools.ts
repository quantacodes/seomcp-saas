/**
 * /tools — SEO capabilities catalog page.
 * User-friendly feature descriptions. No internal tool names exposed.
 * Technical details (tool names, params, examples) live in /docs.
 */

import { Hono } from "hono";

export const toolsRoutes = new Hono();

interface Feature {
  title: string;
  description: string;
  tier: "free" | "google";
}

interface Category {
  id: string;
  icon: string;
  name: string;
  description: string;
  features: Feature[];
}

const CATEGORIES: Category[] = [
  {
    id: "reports",
    icon: "📋",
    name: "Comprehensive Reports",
    description: "One-command full SEO audits that analyze everything and give you a prioritized action plan.",
    features: [
      { title: "Full SEO Report", description: "16-section comprehensive audit with health score (0-100), prioritized recommendations, and competitive benchmarks", tier: "google" },
    ],
  },
  {
    id: "crawl",
    icon: "🔍",
    name: "Crawling & Audit",
    description: "Crawl your entire site or deep-analyze individual pages to find technical SEO issues.",
    features: [
      { title: "Full Site Audit", description: "Crawl up to 50+ pages at once — finds missing titles, broken links, duplicate content, missing alt text, and more", tier: "free" },
      { title: "Single Page Analysis", description: "Deep-dive into any URL — HTML structure, schema markup, headers, internal/external links, images, and performance signals", tier: "free" },
      { title: "Robots.txt Testing", description: "Parse and validate your robots.txt directives to ensure search engines can crawl what they need", tier: "free" },
      { title: "Robots.txt Analysis", description: "Detailed analysis of crawl directives with recommendations for optimization", tier: "free" },
    ],
  },
  {
    id: "gsc",
    icon: "📊",
    name: "Search Console",
    description: "Pull real search performance data directly from Google Search Console — clicks, impressions, CTR, position, and more.",
    features: [
      { title: "Search Performance", description: "Clicks, impressions, CTR, and average position with date ranges, filters, and comparison periods", tier: "google" },
      { title: "URL Inspection", description: "Check indexing status, crawl info, and mobile usability for any URL", tier: "google" },
      { title: "Bulk URL Inspection", description: "Inspect multiple URLs at once — perfect for monitoring indexing across your site", tier: "google" },
      { title: "Sitemap Management", description: "List, submit, and remove XML sitemaps from Search Console", tier: "google" },
      { title: "Site Management", description: "View all verified properties and add new sites", tier: "google" },
      { title: "Search Appearances", description: "Track how your pages appear in search results — rich snippets, AMP, and more", tier: "google" },
    ],
  },
  {
    id: "ga4",
    icon: "📈",
    name: "Google Analytics",
    description: "Access your GA4 data programmatically — traffic, engagement, conversions, and audience insights.",
    features: [
      { title: "Custom Reports", description: "Build any report with flexible metrics, dimensions, date ranges, and filters", tier: "google" },
      { title: "Top Pages", description: "Identify your best-performing content by sessions, engagement, and conversions", tier: "google" },
      { title: "Real-Time Analytics", description: "See live visitor activity — active users, pages being viewed, traffic sources right now", tier: "google" },
      { title: "Traffic Sources", description: "Understand where your visitors come from — organic, paid, social, referral, direct", tier: "google" },
      { title: "Audience Geography", description: "Map visitor locations by country, region, and city", tier: "google" },
      { title: "Device & Browser Data", description: "See what devices, browsers, and screen sizes your audience uses", tier: "google" },
      { title: "Site Overview", description: "Quick snapshot of key metrics — sessions, users, bounce rate, engagement time", tier: "google" },
      { title: "Batch Reports", description: "Run multiple report queries in a single request for efficiency", tier: "google" },
      { title: "Property Management", description: "List and manage your GA4 properties and data streams", tier: "google" },
    ],
  },
  {
    id: "cwv",
    icon: "⚡",
    name: "Core Web Vitals",
    description: "Measure real-world page performance with Google's PageSpeed Insights API.",
    features: [
      { title: "Performance Scoring", description: "LCP, INP, CLS metrics from real Chrome users plus lab data and Lighthouse scores", tier: "free" },
    ],
  },
  {
    id: "schema",
    icon: "🏗️",
    name: "Schema & Structured Data",
    description: "Validate and analyze your structured data markup and crawl configuration.",
    features: [
      { title: "Structured Data Validation", description: "Check JSON-LD schema markup for errors, warnings, and best practices — supports @graph blocks", tier: "free" },
      { title: "Robots.txt Deep Analysis", description: "Comprehensive analysis of robots.txt with bot coverage, directive breakdown, and recommendations", tier: "free" },
    ],
  },
  {
    id: "sitemaps",
    icon: "🗺️",
    name: "Sitemap Analysis",
    description: "Monitor and compare your sitemaps to catch indexing issues early.",
    features: [
      { title: "Sitemap Diff", description: "Compare your sitemap against Search Console data — find URLs missing from index or sitemap", tier: "google" },
    ],
  },
  {
    id: "indexnow",
    icon: "🚀",
    name: "Instant Indexing",
    description: "Push new and updated URLs to search engines immediately via IndexNow and Google Indexing API.",
    features: [
      { title: "Single URL Submit", description: "Push a new or updated page to Bing, Yandex, and other IndexNow-compatible engines instantly", tier: "free" },
      { title: "Bulk URL Submit", description: "Submit hundreds of URLs in a single request for large-scale indexing", tier: "free" },
      { title: "Sitemap-Based Submit", description: "Submit all URLs from your XML sitemap for indexing", tier: "free" },
      { title: "File-Based Submit", description: "Submit URLs from a text file — perfect for CI/CD pipelines", tier: "free" },
      { title: "Google Indexing API", description: "Submit URLs directly to Google for faster crawling via the Indexing API", tier: "google" },
    ],
  },
];

const TOTAL_TOOLS = 37;
const FREE_COUNT = CATEGORIES.reduce((sum, c) => sum + c.features.filter(f => f.tier === "free").length, 0);
const GOOGLE_COUNT = CATEGORIES.reduce((sum, c) => sum + c.features.filter(f => f.tier === "google").length, 0);

function renderPage(): string {
  const categoryHtml = CATEGORIES.map(cat => {
    const featuresHtml = cat.features.map(f => {
      const badge = f.tier === "free"
        ? '<span class="badge free">No OAuth needed</span>'
        : '<span class="badge google">Requires Google credentials</span>';
      return `
        <div class="feature-card">
          <div class="feature-header">
            <h3>${f.title}</h3>
            ${badge}
          </div>
          <p class="feature-desc">${f.description}</p>
        </div>`;
    }).join("");

    return `
      <section class="category" id="cat-${cat.id}">
        <h2>${cat.icon} ${cat.name} <span class="count">(${cat.features.length})</span></h2>
        <p class="cat-desc">${cat.description}</p>
        ${featuresHtml}
      </section>`;
  }).join("");

  const navLinks = CATEGORIES
    .map(cat => `<a href="#cat-${cat.id}">${cat.icon} ${cat.name} (${cat.features.length})</a>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TOTAL_TOOLS} SEO Capabilities for AI Agents — SEO MCP</title>
  <meta name="description" content="Complete reference for all ${TOTAL_TOOLS} SEO capabilities: crawl, audit, Google Search Console, GA4 analytics, Core Web Vitals, schema validation, IndexNow, and more.">
  <meta property="og:title" content="${TOTAL_TOOLS} SEO Capabilities for AI Agents — SEO MCP">
  <meta property="og:description" content="Give any AI agent SEO superpowers. Full capability catalog with descriptions and use cases.">
  <meta property="og:url" content="https://seomcp.dev/tools">
  <meta property="og:type" content="website">
  <link rel="canonical" href="https://seomcp.dev/tools">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0C0C0F; --surface: #16161D; --raised: #1E1E28;
      --border: #2A2A36; --text: #EDEDF0; --muted: #8E8EA0;
      --dim: #5C5C6E; --amber: #E5A430; --sage: #4ADE80;
      --blue: #60A5FA;
    }
    body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 1120px; margin: 0 auto; padding: 2rem 1.5rem; }

    nav { position: sticky; top: 0; z-index: 40; background: rgba(12,12,15,0.9); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    nav .inner { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
    nav .logo { font-size: 16px; font-weight: 600; color: var(--text); text-decoration: none; }
    nav .logo .dot { color: var(--amber); }
    nav .links { display: flex; gap: 20px; align-items: center; }
    nav .links a { font-size: 13px; color: var(--muted); text-decoration: none; transition: color 0.2s; }
    nav .links a:hover { color: var(--text); }
    nav .links .cta { padding: 6px 14px; background: var(--amber); color: var(--bg); border-radius: 8px; font-weight: 600; }

    header { border-bottom: 1px solid var(--border); padding: 3rem 0; margin-bottom: 2rem; }
    header h1 { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    header h1 span { color: var(--amber); }
    header p { color: var(--muted); font-size: 1.05rem; }
    .stats { display: flex; gap: 2rem; margin-top: 1rem; flex-wrap: wrap; }
    .stat { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .stat strong { color: var(--amber); font-size: 1.25rem; }

    .cat-nav { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 2rem; padding: 1rem; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
    .cat-nav a { color: var(--text); text-decoration: none; padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem; transition: background 0.2s; }
    .cat-nav a:hover { background: var(--raised); }

    .category { margin-bottom: 3rem; }
    .category h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; letter-spacing: -0.01em; }
    .category .count { color: var(--muted); font-size: 1rem; font-weight: 400; }
    .cat-desc { color: var(--muted); margin-bottom: 1.5rem; }

    .feature-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
    .feature-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .feature-header h3 { font-size: 1.1rem; font-weight: 600; }
    .feature-desc { color: var(--muted); margin-top: 0.75rem; font-size: 0.95rem; line-height: 1.6; }

    .badge { font-size: 0.7rem; padding: 0.15rem 0.6rem; border-radius: 99px; font-weight: 600; white-space: nowrap; }
    .badge.free { background: rgba(74,222,128,0.12); color: var(--sage); border: 1px solid rgba(74,222,128,0.25); }
    .badge.google { background: rgba(96,165,250,0.12); color: var(--blue); border: 1px solid rgba(96,165,250,0.25); }

    .cta-section { text-align: center; padding: 3rem; background: linear-gradient(135deg, rgba(229,164,48,0.06), rgba(229,164,48,0.02)); border: 1px solid rgba(229,164,48,0.15); border-radius: 16px; margin: 2rem 0; }
    .cta-section h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 0.5rem; }
    .cta-section p { color: var(--muted); margin-bottom: 1.5rem; }
    .cta-section a { display: inline-block; background: var(--amber); color: var(--bg); padding: 0.7rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: background 0.2s; }
    .cta-section a:hover { background: #F0B840; }

    footer { text-align: center; padding: 2rem; color: var(--dim); font-size: 0.85rem; border-top: 1px solid var(--border); margin-top: 3rem; }
    footer a { color: var(--amber); text-decoration: none; }

    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header h1 { font-size: 1.75rem; }
      .stats { flex-direction: column; gap: 0.5rem; }
      .feature-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="inner">
      <a href="https://seomcp.dev" class="logo">seomcp<span class="dot">.dev</span></a>
      <div class="links">
        <a href="https://api.seomcp.dev/docs">Docs</a>
        <a href="https://api.seomcp.dev/dashboard">Dashboard</a>
        <a href="https://seomcp.dev/#pricing" class="cta">Get API Key</a>
      </div>
    </div>
  </nav>

  <div class="container">
    <header>
      <h1><span>${TOTAL_TOOLS}</span> SEO Capabilities for AI Agents</h1>
      <p>Everything your AI agent needs to handle SEO — from auditing to analytics to instant indexing. One API key, one connection.</p>
      <div class="stats">
        <div class="stat"><strong>${TOTAL_TOOLS}</strong> Total capabilities</div>
        <div class="stat"><strong>${FREE_COUNT}</strong> Work without Google OAuth</div>
        <div class="stat"><strong>${GOOGLE_COUNT}</strong> Use your GSC/GA4 data</div>
        <div class="stat"><strong>${CATEGORIES.length}</strong> Categories</div>
      </div>
    </header>

    <nav class="cat-nav">
      ${navLinks}
    </nav>

    ${categoryHtml}

    <div class="cta-section">
      <h2>Ready to give your AI agent SEO superpowers?</h2>
      <p>Sign up free — 100 calls/month. No credit card required.</p>
      <a href="https://seomcp.dev/#pricing">Get Started →</a>
    </div>

    <footer>
      <a href="https://seomcp.dev">seomcp.dev</a> · <a href="https://api.seomcp.dev/docs">Docs</a> · <a href="https://api.seomcp.dev/dashboard">Dashboard</a>
      <br>© 2026 seomcp.dev
    </footer>
  </div>
</body>
</html>`;
}

let cachedPage: string | null = null;
const isDev = process.env.NODE_ENV !== "production";

toolsRoutes.get("/tools", (c) => {
  if (isDev || !cachedPage) {
    cachedPage = renderPage();
  }
  return c.html(cachedPage);
});
