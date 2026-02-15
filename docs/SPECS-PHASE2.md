# SEO MCP SaaS — Phase 2 Specs: Landing Page

**Phase:** 2 — Landing Page (seomcp.dev)  
**Author:** Coral 🧠🔎  
**Date:** 2026-02-13  

---

## Overview

Build a high-converting landing page for seomcp.dev that:
1. Explains the value prop in 5 seconds
2. Shows the "one line of config" setup
3. Displays all 35 tools
4. Has pricing with CTA
5. Converts developers and SEO freelancers to sign up

## Architecture Decision

**Serve from Hono** — no separate Next.js app for the landing page.
- Landing page is static HTML/CSS/JS
- Served from `/` on the same Hono server
- Dashboard (Phase 3) will be a separate Next.js app or SPA
- Keeps deployment simple: one binary, one port

## File Structure

```
seo-mcp-saas/
├── src/
│   ├── routes/
│   │   └── landing.ts          # Serves the landing page HTML
│   └── landing/
│       ├── index.html          # Main landing page
│       ├── style.css           # Styles (Tailwind CDN or hand-crafted)
│       └── script.js           # Minimal JS (copy buttons, smooth scroll)
```

## Page Sections

### 1. Hero
- Headline: "Give any AI agent SEO superpowers"
- Subheadline: "35 SEO tools. One MCP endpoint. Your real Google data."
- CTA: "Get Free API Key" → signup flow
- Code snippet showing one-line MCP config
- Trust: "Uses Google Search Console, Analytics, PageSpeed — your actual data, not estimates"

### 2. How It Works (3 steps)
1. Sign up → get API key (5 seconds)
2. Add one line to your AI tool config
3. Your AI agent now has 35 SEO tools

### 3. Code Demo
Show the MCP config for Claude Desktop, Cursor, and generic:
```json
{
  "mcpServers": {
    "seo": {
      "url": "https://seomcp.dev/mcp",
      "headers": { "Authorization": "Bearer sk_live_REDACTED_key" }
    }
  }
}
```

### 4. Tools Grid
Show all 35 tools organized by category:
- **Crawl** (3): site_audit, crawl_page, test_robots_txt
- **Google Search Console** (8): gsc_performance, gsc_list_sites, etc.
- **Google Analytics** (9): ga4_report, ga4_realtime, etc.
- **Core Web Vitals** (1): core_web_vitals
- **Schema** (2): validate_schema, analyze_robots_txt
- **IndexNow** (4): submit URLs for instant indexing
- **Reports** (1): generate_report (one-command full audit)

### 5. Comparison Table
| Feature | seomcp.dev | Ahrefs | DataForSEO | FetchSERP |
|---------|-----------|--------|------------|-----------|
| Price | $29/mo | $129/mo | $50+ min | Credit-based |
| Real Google data | ✅ | ❌ | ❌ | ❌ |
| MCP native | ✅ | ✅ | ✅ | ✅ |
| Hosted | ✅ | ❌ (bundled) | ❌ | ✅ |
| Tools | 35 | ? | 9 modules | 15 |
| Setup | 1 line | Subscription | API setup | Credits + setup |

### 6. Pricing
Three tiers with toggle (monthly/annual):
- **Free**: 50 calls/mo, 1 site, 1 API key — "Get Started Free"
- **Pro $29/mo**: 2,000 calls/mo, 5 sites, 5 keys — "Start Pro Trial"
- **Agency $79/mo**: 10,000 calls/mo, unlimited sites — "Contact Sales"

### 7. FAQ
- What is MCP?
- What tools are included?
- Do I need a Google account?
- How does billing work?
- Is there a free tier?
- Can I use this with ChatGPT/Claude/Cursor?

### 8. Footer
- Links: Docs, GitHub, Pricing, Blog, Status
- Legal: Terms, Privacy
- Made by QuantaCodes

## Design System

### Colors
- Primary: `#0ea5e9` (sky-500) — trust, tech
- Accent: `#f97316` (orange-500) — CTAs, highlights
- Background: `#0f172a` (slate-900) — dark mode default
- Surface: `#1e293b` (slate-800) — cards
- Text: `#f8fafc` (slate-50)
- Muted: `#94a3b8` (slate-400)

### Typography
- Font: Inter (Google Fonts) or system stack
- Headings: Bold, large
- Code: JetBrains Mono or Fira Code

### Layout
- Max width: 1200px
- Mobile-first responsive
- Single page, smooth scroll
- No framework bloat — vanilla HTML/CSS/JS + Tailwind CDN

## Signup Flow (on landing page)

Simple modal or inline form:
1. Email + Password
2. → POST /api/auth/signup
3. → Show API key (with copy button)
4. → Show MCP config snippet with their key pre-filled
5. → "Copy this to your AI tool and you're done"

## SEO Meta

```html
<title>seomcp.dev — 35 SEO Tools for Any AI Agent | MCP Server</title>
<meta name="description" content="Give any AI agent SEO superpowers. 35 tools including Google Search Console, Analytics, site audits, and IndexNow. One MCP endpoint. $29/mo.">
<meta property="og:title" content="seomcp.dev — SEO Tools for AI Agents">
<meta property="og:description" content="35 SEO tools. One MCP endpoint. Your real Google data.">
```

## Implementation Plan

1. Create landing route in Hono (serve static files from `/`)
2. Build HTML structure with all sections
3. Style with Tailwind CDN (dark mode)
4. Add minimal JS (copy buttons, signup modal, smooth scroll)
5. Wire signup form to POST /api/auth/signup
6. Test on mobile and desktop
7. Ensure all links work

## No-Build Approach

Using Tailwind CDN + vanilla JS means:
- No build step needed
- Instant iteration
- Easy to maintain
- Can migrate to Next.js later when dashboard is needed
