import { Hono } from "hono";

export const changelogRoutes = new Hono();

interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-02-13",
    version: "v0.2.0",
    title: "Audit History, Key Scoping & More",
    items: [
      "📊 Audit History — automatically stores generate_report and site_audit results for tracking SEO health over time",
      "🔐 Key Scoping — restrict API keys to specific tool categories (crawl, gsc, ga4, schema, indexnow, report)",
      "📈 Health Score Trends — view how your SEO health score changes over time per site",
      "📝 Changelog page — you're looking at it",
      "🔍 Better social sharing — OG images and Twitter cards on all pages",
      "⚡ Retention limits by plan — Free: 7 days / Pro: 30 days / Agency: 90 days",
    ],
  },
  {
    date: "2026-02-13",
    version: "v0.1.0",
    title: "Initial Launch",
    items: [
      "🚀 All 35 SEO tools available via MCP Streamable HTTP",
      "🔑 API key authentication with Bearer tokens",
      "⏱️ Rate limiting per plan tier (monthly window)",
      "🔗 Google OAuth for GSC + GA4 access (AES-256-GCM encrypted tokens)",
      "🎮 Interactive Playground — try 3 tools without signup",
      "📊 Dashboard with usage stats, API key management, activity feed",
      "💳 Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume)",
      "📖 Full API documentation (8 sections)",
      "🛡️ Admin API (stats, user management, usage analytics)",
      "📋 Tool catalog page with 35 tools across 9 categories",
      "📜 OpenAPI 3.1 spec at /openapi.json",
      "🔍 MCP discovery at /.well-known/mcp",
      "⚡ Setup script — curl -fsSL seomcp.dev/setup | bash",
      "📄 Terms of Service and Privacy Policy (Google compliance)",
      "🔒 IP rate limiting on signup/login (proxy-aware)",
      "🐳 Docker + Fly.io deployment configs",
      "✅ 180 tests, 493 assertions",
    ],
  },
];

function renderChangelog(): string {
  const entries = CHANGELOG.map((entry) => {
    const items = entry.items
      .map((item) => `<li class="text-slate-300 text-sm leading-relaxed">${escapeHtml(item)}</li>`)
      .join("\n");

    return `
    <div class="border-l-2 border-brand-500/30 pl-6 pb-12 relative">
      <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-brand-500 border-4 border-surface-900"></div>
      <div class="flex items-center gap-3 mb-3">
        <span class="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">${escapeHtml(entry.version)}</span>
        <span class="text-xs text-slate-500">${escapeHtml(entry.date)}</span>
      </div>
      <h3 class="text-lg font-bold text-white mb-4">${escapeHtml(entry.title)}</h3>
      <ul class="space-y-2 list-none">
        ${items}
      </ul>
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changelog — seomcp.dev</title>
  <meta name="description" content="What's new in seomcp.dev — the latest features, improvements, and fixes for your AI-powered SEO toolkit.">
  <link rel="canonical" href="https://seomcp.dev/changelog">
  ${ogMeta("Changelog — seomcp.dev", "What's new in seomcp.dev — latest features, improvements, and fixes.", "https://seomcp.dev/changelog")}
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          colors: {
            brand: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1' },
            surface: { 900: '#0f172a', 800: '#1e293b', 700: '#334155', 600: '#475569' },
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0f172a; color: #f8fafc; }
    .gradient-text { background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  </style>
</head>
<body class="font-sans antialiased">
  <!-- Nav -->
  <nav class="sticky top-0 z-40 bg-surface-900/95 backdrop-blur-xl border-b border-white/5">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 text-base font-bold">
        <span class="text-xl">🔍</span>
        <span class="gradient-text">seomcp</span><span class="text-slate-400">.dev</span>
      </a>
      <div class="flex items-center gap-4">
        <a href="/docs" class="text-sm text-slate-400 hover:text-white transition">Docs</a>
        <a href="/tools" class="text-sm text-slate-400 hover:text-white transition">Tools</a>
        <a href="/playground" class="text-sm text-slate-400 hover:text-white transition">Playground</a>
        <a href="/dashboard" class="text-sm text-slate-400 hover:text-white transition">Dashboard</a>
      </div>
    </div>
  </nav>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 py-16">
    <div class="mb-12">
      <h1 class="text-3xl font-extrabold mb-2">Changelog</h1>
      <p class="text-slate-400">What's new and improved in seomcp.dev</p>
    </div>

    <div class="space-y-0">
      ${entries}
    </div>

    <div class="mt-16 text-center">
      <p class="text-sm text-slate-500 mb-4">Want to be notified of updates?</p>
      <a href="https://x.com/pinchy0x" target="_blank" rel="noopener noreferrer" class="text-brand-400 hover:text-brand-300 text-sm font-medium">Follow @pinchy0x on X →</a>
    </div>
  </main>

  <footer class="border-t border-white/5 py-8 text-center text-sm text-slate-500">
    <div class="max-w-4xl mx-auto px-4">
      <a href="/" class="hover:text-white transition">Home</a> · 
      <a href="/docs" class="hover:text-white transition">Docs</a> · 
      <a href="/tools" class="hover:text-white transition">Tools</a> · 
      <a href="/terms" class="hover:text-white transition">Terms</a> · 
      <a href="/privacy" class="hover:text-white transition">Privacy</a>
    </div>
  </footer>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ogMeta(title: string, description: string, url: string): string {
  return `
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="seomcp.dev">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:site" content="@pinchy0x">`;
}

let cachedHtml: string | null = null;

changelogRoutes.get("/changelog", (c) => {
  if (process.env.NODE_ENV !== "production" || !cachedHtml) {
    cachedHtml = renderChangelog();
  }
  return c.html(cachedHtml);
});
