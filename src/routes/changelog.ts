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
    version: "v0.3.0",
    title: "Teams, Email Verification, Password Reset & Production Polish",
    items: [
      "👥 Team/Organization support — create teams, invite members, shared usage pools (Agency+ plans)",
      "🔄 API key rotation — atomic revoke + create with preserved name and scopes",
      "📧 Email verification — magic link verification via Resend API",
      "🔑 Password reset — forgot password flow with secure HMAC tokens",
      "📋 Onboarding checklist — 5-step guided setup with auto-completion detection",
      "🔔 User webhooks — HMAC-SHA256 signed delivery for audit + usage alerts",
      "⏰ Scheduled audits — daily/weekly/monthly automated SEO audits",
      "📨 Usage alert emails — notifications at 80% and 100% quota with upgrade CTA",
      "🚫 Custom error pages — styled HTML 404/500 for browsers",
      "🔒 IP rate limiting on signup (5/hr) and login (10/15min) — proxy-aware",
      "📝 Structured JSON logging with request timing",
      "🧪 E2E integration test — complete user journey from signup to dashboard",
      "✅ 383 tests, 879 assertions",
    ],
  },
  {
    date: "2026-02-13",
    version: "v0.2.0",
    title: "Audit History, Key Scoping, Playground & Admin",
    items: [
      "📊 Audit History — automatically stores generate_report and site_audit results",
      "🔐 Key Scoping — restrict API keys to specific tool categories (9 categories)",
      "🎮 Interactive Playground — try 3 tools without signup, SSRF-hardened",
      "🛡️ Admin API — stats, user management, plan overrides, usage analytics, error listing",
      "📋 Tool catalog page — 35 tools with categories, parameters, and examples",
      "📜 OpenAPI 3.1 spec at /openapi.json",
      "🔍 MCP discovery at /.well-known/mcp",
      "⚡ Setup script — curl -fsSL seomcp.dev/setup | bash",
      "📈 Health Score Trends — track SEO health over time per site",
      "📝 Changelog page",
      "🤖 robots.txt + sitemap.xml",
      "🔁 Binary auto-retry on crash",
      "📄 Terms of Service and Privacy Policy (Google compliance)",
    ],
  },
  {
    date: "2026-02-13",
    version: "v0.1.0",
    title: "Initial Release",
    items: [
      "🚀 All 35 SEO tools available via MCP Streamable HTTP",
      "🔑 API key authentication with Bearer tokens (sk_live_* format)",
      "⏱️ Rate limiting per plan tier (monthly window)",
      "🔗 Google OAuth for GSC + GA4 access (AES-256-GCM encrypted tokens)",
      "📊 Dashboard with usage stats, API key management, activity feed",
      "💳 Lemon Squeezy billing (checkout overlay, webhooks, cancel/resume)",
      "📖 Full API documentation (8 sections)",
      "🏠 Landing page with signup flow + MCP config snippet + JSON-LD structured data",
      "🐳 Docker + docker-compose + Fly.io deployment configs",
      "🔒 Security headers + CSRF protection + rate limit headers + request IDs",
    ],
  },
];

function renderChangelog(): string {
  const entries = CHANGELOG.map((entry) => {
    const items = entry.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("\n");

    return `
    <div class="entry">
      <div class="entry-dot"></div>
      <div class="entry-meta">
        <span class="version">${escapeHtml(entry.version)}</span>
        <span class="date">${escapeHtml(entry.date)}</span>
      </div>
      <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
      <ul class="entry-list">
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,sans-serif;background:#0C0C0F;color:#EDEDF0;line-height:1.6;-webkit-font-smoothing:antialiased}
    a{color:inherit;text-decoration:none}
    nav{position:sticky;top:0;z-index:40;height:56px;display:flex;align-items:center;background:rgba(12,12,15,0.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid #2A2A36}
    nav .inner{max-width:1120px;margin:0 auto;padding:0 24px;width:100%;display:flex;align-items:center;justify-content:space-between}
    .logo{font-size:16px;font-weight:600}.logo .dot{color:#E5A430}
    .links{display:flex;gap:20px;align-items:center}
    .links a{font-size:13px;color:#8E8EA0;transition:color 0.2s}.links a:hover{color:#EDEDF0}
    main{max-width:800px;margin:0 auto;padding:64px 24px}
    h1{font-size:32px;font-weight:700;letter-spacing:-0.02em;margin-bottom:6px}
    .sub{font-size:15px;color:#8E8EA0;margin-bottom:48px}
    .entry{border-left:2px solid rgba(229,164,48,0.25);padding-left:24px;padding-bottom:48px;position:relative}
    .entry-dot{position:absolute;left:-7px;top:0;width:12px;height:12px;border-radius:50%;background:#E5A430;border:3px solid #0C0C0F}
    .entry-meta{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    .version{font-size:12px;font-family:'JetBrains Mono',monospace;color:#E5A430;background:rgba(229,164,48,0.1);padding:2px 8px;border-radius:4px}
    .date{font-size:12px;color:#5C5C6E}
    .entry-title{font-size:18px;font-weight:600;margin-bottom:12px}
    .entry-list{list-style:none}
    .entry-list li{font-size:14px;color:#8E8EA0;line-height:1.7;padding:2px 0}
    .follow{margin-top:64px;text-align:center}
    .follow p{font-size:13px;color:#5C5C6E;margin-bottom:8px}
    .follow a{font-size:14px;color:#E5A430;font-weight:500}
    footer{border-top:1px solid #2A2A36;margin-top:48px;padding:24px 0;text-align:center;font-size:13px;color:#5C5C6E}
    footer a{color:#8E8EA0;transition:color 0.2s}footer a:hover{color:#EDEDF0}
    @media(max-width:768px){main{padding:32px 16px}h1{font-size:24px}}
  </style>
</head>
<body>
  <nav>
    <div class="inner">
      <a href="/" class="logo">seomcp<span class="dot">.dev</span></a>
      <div class="links">
        <a href="/docs">Docs</a>
        <a href="/tools">Tools</a>
        <a href="/playground">Playground</a>
        <a href="/dashboard">Dashboard</a>
      </div>
    </div>
  </nav>

  <main>
    <h1>Changelog</h1>
    <p class="sub">What's new and improved in seomcp.dev</p>
    ${entries}
    <div class="follow">
      <p>Want to be notified of updates?</p>
      <a href="https://x.com/pinchy0x" target="_blank" rel="noopener noreferrer">Follow @pinchy0x on X →</a>
    </div>
  </main>

  <footer>
    <a href="/">Home</a> · <a href="/docs">Docs</a> · <a href="/tools">Tools</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
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
