/**
 * /tools — SEO tool catalog page.
 * Beautiful, SEO-optimized reference of all 35 tools with params and examples.
 * Design: Obsidian & Amber theme matching seomcp.dev landing page.
 */

import { Hono } from "hono";
import { TOOLS, TOOL_CATEGORIES, TOOL_COUNT, FREE_TOOLS, GOOGLE_TOOLS } from "../tools-catalog";

export const toolsRoutes = new Hono();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderToolCard(tool: typeof TOOLS[0]): string {
  const paramsHtml = tool.params.length > 0
    ? `<div class="params">
        <h4>Parameters</h4>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Req</th><th>Description</th></tr></thead>
          <tbody>
            ${tool.params.map(p => `
              <tr>
                <td><code>${escapeHtml(p.name)}</code></td>
                <td><span class="type">${escapeHtml(p.type)}</span></td>
                <td>${p.required ? '<span class="req">✓</span>' : '<span class="opt">—</span>'}</td>
                <td>${escapeHtml(p.description)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
       </div>`
    : `<p class="no-params">No parameters required</p>`;

  const exampleHtml = tool.example
    ? `<div class="example">
        <h4>Example</h4>
        <pre><code>${escapeHtml(tool.example)}</code></pre>
       </div>`
    : "";

  const tierBadge = tool.tier === "free"
    ? '<span class="badge free">No OAuth needed</span>'
    : '<span class="badge google">Requires Google OAuth</span>';

  return `
    <div class="tool-card" id="${tool.name}">
      <div class="tool-header">
        <h3><span class="icon">${tool.categoryIcon}</span> ${tool.name}</h3>
        ${tierBadge}
      </div>
      <p class="tool-desc">${escapeHtml(tool.description)}</p>
      ${paramsHtml}
      ${exampleHtml}
    </div>
  `;
}

function renderPage(): string {
  const categoryHtml = TOOL_CATEGORIES.map(cat => {
    const catTools = TOOLS.filter(t => t.category === cat.id);
    if (catTools.length === 0) return "";
    return `
      <section class="category" id="cat-${cat.id}">
        <h2>${cat.icon} ${cat.name} <span class="count">(${catTools.length} tools)</span></h2>
        <p class="cat-desc">${cat.description}</p>
        ${catTools.map(renderToolCard).join("")}
      </section>
    `;
  }).join("");

  const navLinks = TOOL_CATEGORIES
    .filter(cat => TOOLS.some(t => t.category === cat.id))
    .map(cat => {
      const count = TOOLS.filter(t => t.category === cat.id).length;
      return `<a href="#cat-${cat.id}">${cat.icon} ${cat.name} (${count})</a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>35 SEO Tools for AI Agents — SEO MCP Tool Catalog</title>
  <meta name="description" content="Complete reference for all 35 SEO tools: crawl, audit, Google Search Console, GA4 analytics, Core Web Vitals, schema validation, IndexNow, and more.">
  <meta property="og:title" content="35 SEO Tools for AI Agents — SEO MCP">
  <meta property="og:description" content="Give any AI agent SEO superpowers. Full tool catalog with parameters, examples, and usage.">
  <meta property="og:url" content="https://seomcp.dev/tools">
  <meta property="og:type" content="website">
  <link rel="canonical" href="https://seomcp.dev/tools">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0C0C0F; --surface: #16161D; --raised: #1E1E28;
      --border: #2A2A36; --text: #EDEDF0; --muted: #8E8EA0;
      --dim: #5C5C6E; --amber: #E5A430; --sage: #4ADE80;
      --blue: #60A5FA; --coral: #F87171; --orange: #FBBF24;
    }
    body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 1120px; margin: 0 auto; padding: 2rem 1.5rem; }

    /* Nav */
    nav { position: sticky; top: 0; z-index: 40; background: rgba(12,12,15,0.9); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    nav .inner { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
    nav .logo { font-size: 16px; font-weight: 600; color: var(--text); text-decoration: none; }
    nav .logo .dot { color: var(--amber); }
    nav .links { display: flex; gap: 20px; align-items: center; }
    nav .links a { font-size: 13px; color: var(--muted); text-decoration: none; transition: color 0.2s; }
    nav .links a:hover { color: var(--text); }
    nav .links .cta { padding: 6px 14px; background: var(--amber); color: var(--bg); border-radius: 8px; font-weight: 600; }

    /* Header */
    header { border-bottom: 1px solid var(--border); padding: 3rem 0; margin-bottom: 2rem; }
    header h1 { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    header h1 span { color: var(--amber); }
    header p { color: var(--muted); font-size: 1.05rem; }
    .stats { display: flex; gap: 2rem; margin-top: 1rem; flex-wrap: wrap; }
    .stat { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .stat strong { color: var(--amber); font-size: 1.25rem; }

    /* Category nav */
    .cat-nav { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 2rem; padding: 1rem; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
    .cat-nav a { color: var(--text); text-decoration: none; padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem; transition: background 0.2s; }
    .cat-nav a:hover { background: var(--raised); }

    /* Category */
    .category { margin-bottom: 3rem; }
    .category h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; letter-spacing: -0.01em; }
    .category .count { color: var(--muted); font-size: 1rem; font-weight: 400; }
    .cat-desc { color: var(--muted); margin-bottom: 1.5rem; }

    /* Tool card */
    .tool-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
    .tool-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .tool-header h3 { font-size: 1.1rem; font-weight: 600; }
    .tool-header .icon { margin-right: 0.3rem; }
    .tool-desc { color: var(--muted); margin: 0.75rem 0; font-size: 0.95rem; }

    /* Badges */
    .badge { font-size: 0.7rem; padding: 0.15rem 0.6rem; border-radius: 99px; font-weight: 600; white-space: nowrap; }
    .badge.free { background: rgba(74,222,128,0.12); color: var(--sage); border: 1px solid rgba(74,222,128,0.25); }
    .badge.google { background: rgba(96,165,250,0.12); color: var(--blue); border: 1px solid rgba(96,165,250,0.25); }

    /* Params table */
    .params h4, .example h4 { font-size: 0.8rem; color: var(--dim); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); color: var(--dim); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 0.4rem 0.6rem; border-bottom: 1px solid rgba(42,42,54,0.4); color: var(--muted); }
    code { font-family: 'JetBrains Mono', monospace; background: rgba(229,164,48,0.08); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.82rem; color: var(--amber); }
    .type { font-size: 0.78rem; color: var(--orange); }
    .req { color: var(--sage); }
    .opt { color: var(--dim); }
    .no-params { color: var(--dim); font-size: 0.9rem; }

    /* Example */
    .example { margin-top: 1rem; }
    .example pre { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; }
    .example pre code { background: none; padding: 0; color: var(--muted); font-size: 0.82rem; }

    /* CTA */
    .cta-section { text-align: center; padding: 3rem; background: linear-gradient(135deg, rgba(229,164,48,0.06), rgba(229,164,48,0.02)); border: 1px solid rgba(229,164,48,0.15); border-radius: 16px; margin: 2rem 0; }
    .cta-section h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 0.5rem; }
    .cta-section p { color: var(--muted); margin-bottom: 1.5rem; }
    .cta-section a { display: inline-block; background: var(--amber); color: var(--bg); padding: 0.7rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: background 0.2s; }
    .cta-section a:hover { background: #F0B840; }

    /* Footer */
    footer { text-align: center; padding: 2rem; color: var(--dim); font-size: 0.85rem; border-top: 1px solid var(--border); margin-top: 3rem; }
    footer a { color: var(--amber); text-decoration: none; }

    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header h1 { font-size: 1.75rem; }
      .stats { flex-direction: column; gap: 0.5rem; }
      .cat-nav { gap: 0.3rem; }
      .tool-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="inner">
      <a href="/" class="logo">seomcp<span class="dot">.dev</span></a>
      <div class="links">
        <a href="/docs">Docs</a>
        <a href="/playground">Playground</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/#pricing" class="cta">Get API Key</a>
      </div>
    </div>
  </nav>

  <div class="container">
    <header>
      <h1><span>${TOOL_COUNT}</span> SEO Tools for AI Agents</h1>
      <p>Complete reference for every tool available through SEO MCP. Each tool is callable via MCP protocol with one API key.</p>
      <div class="stats">
        <div class="stat"><strong>${TOOL_COUNT}</strong> Total tools</div>
        <div class="stat"><strong>${FREE_TOOLS}</strong> Work without Google OAuth</div>
        <div class="stat"><strong>${GOOGLE_TOOLS}</strong> Use your GSC/GA4 data</div>
        <div class="stat"><strong>9</strong> Categories</div>
      </div>
    </header>

    <nav class="cat-nav">
      ${navLinks}
    </nav>

    ${categoryHtml}

    <div class="cta-section">
      <h2>Ready to give your AI agent SEO superpowers?</h2>
      <p>Sign up free — get 50 tool calls/month. No credit card required.</p>
      <a href="/#pricing">Get Started →</a>
    </div>

    <footer>
      <a href="/">seomcp.dev</a> · <a href="/playground">Playground</a> · <a href="/docs">Docs</a> · <a href="/openapi.json">OpenAPI Spec</a>
      <br>© 2026 seomcp.dev
    </footer>
  </div>
</body>
</html>`;
}

// Cache rendered page
let cachedPage: string | null = null;
const isDev = process.env.NODE_ENV !== "production";

toolsRoutes.get("/tools", (c) => {
  if (isDev || !cachedPage) {
    cachedPage = renderPage();
  }
  return c.html(cachedPage);
});

// JSON endpoint for programmatic access
toolsRoutes.get("/api/tools", (c) => {
  return c.json({
    total: TOOL_COUNT,
    freeTools: FREE_TOOLS,
    googleTools: GOOGLE_TOOLS,
    categories: TOOL_CATEGORIES,
    tools: TOOLS,
  });
});
