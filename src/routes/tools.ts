/**
 * /tools — SEO tool catalog page.
 * Beautiful, SEO-optimized reference of all 35 tools with params and examples.
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
          <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0a0a0f; --card: #12121a; --border: #1e1e2e;
      --text: #e0e0e0; --muted: #888; --accent: #6366f1;
      --green: #22c55e; --blue: #3b82f6; --orange: #f59e0b;
    }
    body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }

    /* Header */
    header { border-bottom: 1px solid var(--border); padding: 2rem 0; margin-bottom: 2rem; }
    header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    header h1 span { color: var(--accent); }
    header p { color: var(--muted); font-size: 1.1rem; }
    .stats { display: flex; gap: 2rem; margin-top: 1rem; }
    .stat { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; }
    .stat strong { color: var(--accent); font-size: 1.3rem; }

    /* Back link */
    .back { display: inline-block; color: var(--accent); text-decoration: none; margin-bottom: 1rem; font-size: 0.9rem; }
    .back:hover { text-decoration: underline; }

    /* Nav */
    .nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; padding: 1rem; background: var(--card); border-radius: 12px; border: 1px solid var(--border); }
    .nav a { color: var(--text); text-decoration: none; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; transition: background 0.2s; }
    .nav a:hover { background: var(--border); }

    /* Category */
    .category { margin-bottom: 3rem; }
    .category h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .category .count { color: var(--muted); font-size: 1rem; font-weight: normal; }
    .cat-desc { color: var(--muted); margin-bottom: 1.5rem; }

    /* Tool card */
    .tool-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
    .tool-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .tool-header h3 { font-size: 1.15rem; }
    .tool-header .icon { margin-right: 0.3rem; }
    .tool-desc { color: var(--muted); margin: 0.75rem 0; }

    /* Badges */
    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 500; white-space: nowrap; }
    .badge.free { background: rgba(34,197,94,0.15); color: var(--green); border: 1px solid rgba(34,197,94,0.3); }
    .badge.google { background: rgba(59,130,246,0.15); color: var(--blue); border: 1px solid rgba(59,130,246,0.3); }

    /* Params table */
    .params h4, .example h4 { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); color: var(--muted); font-weight: 500; font-size: 0.8rem; text-transform: uppercase; }
    td { padding: 0.4rem 0.6rem; border-bottom: 1px solid rgba(30,30,46,0.5); }
    code { font-family: 'SF Mono', 'Fira Code', monospace; background: rgba(99,102,241,0.1); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85rem; color: var(--accent); }
    .type { font-size: 0.8rem; color: var(--orange); }
    .req { color: var(--green); }
    .opt { color: var(--muted); }
    .no-params { color: var(--muted); font-size: 0.9rem; }

    /* Example */
    .example { margin-top: 1rem; }
    .example pre { background: #0d0d14; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; }
    .example pre code { background: none; padding: 0; color: var(--text); font-size: 0.85rem; }

    /* CTA */
    .cta { text-align: center; padding: 3rem; background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05)); border: 1px solid rgba(99,102,241,0.2); border-radius: 16px; margin: 2rem 0; }
    .cta h2 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .cta p { color: var(--muted); margin-bottom: 1.5rem; }
    .cta a { display: inline-block; background: var(--accent); color: white; padding: 0.75rem 2rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1.1rem; transition: transform 0.2s, box-shadow 0.2s; }
    .cta a:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.3); }

    /* Footer */
    footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--border); margin-top: 3rem; }
    footer a { color: var(--accent); text-decoration: none; }

    /* Responsive */
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header h1 { font-size: 1.8rem; }
      .stats { flex-direction: column; gap: 0.5rem; }
      .nav { gap: 0.3rem; }
      .tool-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back">← Back to seomcp.dev</a>

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

    <nav class="nav">
      ${navLinks}
    </nav>

    ${categoryHtml}

    <div class="cta">
      <h2>Ready to give your AI agent SEO superpowers?</h2>
      <p>Sign up free — get 50 tool calls/month. No credit card required.</p>
      <a href="/#pricing">Get Started →</a>
    </div>

    <footer>
      <a href="/">seomcp.dev</a> · <a href="/playground">Playground</a> · <a href="/docs">Docs</a> · <a href="/openapi.json">OpenAPI Spec</a>
      <br>© 2026 SEO MCP
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
