# seomcp.dev — Launch Materials

## X Announcement Thread

### Tweet 1 (Hook)
I just shipped a way to give any AI agent 35 SEO tools.

One line of config. Your real Google Search Console + Analytics data.

seomcp.dev — here's how it works 🧵

### Tweet 2 (The Problem)
AI agents are getting smarter, but they're blind to SEO.

They can write content, build sites, deploy apps.

But they can't check rankings, audit a page, or submit to IndexNow.

Until now.

### Tweet 3 (What It Is)
seomcp.dev is a remote MCP server with 35 SEO tools:

• Google Search Console (8 tools)
• GA4 Analytics (9 tools)
• Site audits + crawling (3 tools)
• Schema validation (2 tools)
• IndexNow submissions (4 tools)
• Full audit reports (1 command)

All through one API endpoint.

### Tweet 4 (How Easy)
Setup takes 10 seconds.

Add this to your MCP config:

```json
{
  "seo": {
    "url": "https://seomcp.dev/mcp",
    "headers": {
      "Authorization": "Bearer sk_live_REDACTED_key"
    }
  }
}
```

Now your AI agent has SEO superpowers.

### Tweet 5 (The Difference)
Other SEO APIs give you scraped estimates.

We use YOUR Google Search Console and GA4 data.

Real clicks. Real impressions. Real rankings.

Not "estimated traffic" from a 3rd-party crawler.

### Tweet 6 (Real Example)
Ask Claude: "Run an SEO audit on my site"

It calls `generate_report` and gets:
- Health score (0-100)
- CWV metrics
- Schema validation
- Crawl errors
- GSC performance
- Top pages + queries
- Actionable recommendations

One command. Full picture.

### Tweet 7 (Pricing)
Pricing that doesn't insult you:

Free: 50 calls/mo ($0)
Pro: 2,000 calls/mo ($29)
Agency: 10,000 calls/mo ($79)

Compare: Ahrefs API = $99+/mo, DataForSEO = $0.02/task

### Tweet 8 (Tech)
Built with:
- Rust binary engine (35 tools, 8MB, ~40K lines)
- Bun/Hono API gateway
- MCP Streamable HTTP transport
- AES-256-GCM encrypted Google tokens
- SQLite (zero infra overhead)

102 tests. Production ready.

### Tweet 9 (CTA)
Try it free at seomcp.dev

50 API calls/mo. No credit card.

If you're building AI agents that touch SEO in any way — this is the missing piece.

🔗 seomcp.dev

---

## Product Hunt

### Tagline
35 SEO tools for any AI agent — one MCP endpoint

### Description
seomcp.dev gives AI agents real SEO capabilities through the Model Context Protocol (MCP).

Connect your Google Search Console and GA4, add one line to your MCP config, and your AI agent gets 35 professional SEO tools:

**Google Search Console** — Performance data, URL inspection, sitemap management, search appearances
**GA4 Analytics** — Traffic reports, realtime data, top pages, traffic sources, geography
**Site Audits** — Full crawl, robots.txt testing, schema validation
**IndexNow** — Submit URLs to Bing/Yandex/etc instantly
**Reports** — One-command comprehensive audit with health score

Unlike other SEO APIs that give you estimated/scraped data, seomcp.dev uses YOUR actual Google data — real clicks, real impressions, real rankings.

Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible tool.

**Pricing:** Free (50 calls/mo), Pro $29/mo (2K calls), Agency $79/mo (10K calls)

### Topics
- Artificial Intelligence
- SEO
- Developer Tools
- API
- MCP

### First Comment
Hey Product Hunt! 👋

I built seomcp.dev because I was frustrated with the disconnect between AI agents and SEO tools.

My AI agent could write blog posts, but couldn't check if they were ranking. Could build a site, but couldn't audit it. Could deploy, but couldn't submit to search engines.

So I wrapped our 35-tool Rust SEO engine into a hosted MCP server. Connect your Google accounts, add one line to your config, and your AI has full SEO vision.

The engine (seo-mcp) has been running our own SEO operations — grew one site from 0 to 400+ daily sessions in 2 weeks using only AI-driven SEO.

Happy to answer any questions! 🔍

---

## Reddit Posts

### r/SEO
**Title:** I built a way to give AI agents access to your Google Search Console + GA4 data

Just shipped seomcp.dev — it's a hosted MCP server that gives AI agents 35 SEO tools including GSC, GA4, site audits, schema validation, and IndexNow.

The key difference from other SEO APIs: it uses YOUR actual Google data, not scraped estimates. You connect your Google account via OAuth, and your AI agent gets real click data, real rankings, real impressions.

Works with Claude, Cursor, and any MCP-compatible tool. Free tier: 50 calls/month.

Would love feedback from the SEO community — what tools would you want your AI agent to have?

### r/artificial
**Title:** MCP server that gives any AI agent 35 SEO tools (Google Search Console, GA4, audits)

Built a hosted MCP server (seomcp.dev) that wraps a Rust binary with 35 SEO tools. AI agents can:

- Check rankings and traffic from your actual Google Search Console
- Run full site audits with health scores
- Validate schema markup
- Submit URLs to search engines via IndexNow
- Pull GA4 analytics data

One line of MCP config and your agent has SEO superpowers. Uses real Google data, not estimates.

Tech: Rust engine, Bun/Hono gateway, MCP Streamable HTTP transport, AES-256-GCM token encryption.

### Hacker News
**Title:** Show HN: seomcp.dev — 35 SEO tools as a remote MCP server

seomcp.dev wraps a Rust binary (seo-mcp, ~40K lines, 35 tools) into a hosted MCP-compliant HTTP endpoint. Users connect their Google Search Console and GA4 via OAuth, and any MCP-compatible AI agent gets access to real SEO data — rankings, traffic, site audits, schema validation, IndexNow.

Architecture: Bun/Hono gateway spawns per-user Rust binary processes via stdio JSON-RPC. Google tokens encrypted with AES-256-GCM at rest. Monthly rate limiting with atomic increment. SQLite for everything.

Motivation: Existing SEO APIs either use scraped/estimated data (Ahrefs, SEMrush) or are prohibitively expensive. This uses your actual Google data at $29/mo for 2K calls.

Free tier: 50 calls/month, no credit card.
