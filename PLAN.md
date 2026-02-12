# SEO MCP SaaS — MVP Plan

**Codename:** SEO MCP Cloud
**Tagline:** "Give any AI agent SEO superpowers in one line of config"
**Started:** 2026-02-12

---

## Value Proposition
- First MCP-native SEO tool as a service
- AI-agent-first (not human-dashboard-first)
- Uses real Google data (GSC, GA4) not scraped estimates
- Actions, not just reports (IndexNow, bulk inspect, sitemap management)
- $29/mo vs $99-999/mo for Ahrefs/Semrush
- One command = full audit with health score

## Target Customers
1. **AI developers** building agents that need SEO capabilities
2. **Indie hackers / solopreneurs** managing their own sites
3. **Small agencies** managing multiple client sites
4. **Content teams** using AI for SEO workflows

## Architecture

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐
│  User's AI Agent │ ◄──────────────────► │  SEO MCP Gateway  │
│  (Claude, Cursor, │     (SSE/HTTP)       │  (API + Auth)     │
│   Windsurf, etc) │                       └────────┬─────────┘
└─────────────────┘                                 │
                                                    ▼
                                          ┌──────────────────┐
                                          │  seo-mcp engine   │
                                          │  (Rust binary)    │
                                          └────────┬─────────┘
                                                    │
                              ┌──────────┬──────────┼──────────┐
                              ▼          ▼          ▼          ▼
                           Google     Google     PageSpeed   IndexNow
                           Search     Analytics  Insights    API
                           Console    (GA4)      API
```

## Tech Stack
- **Backend:** Node.js/Bun API gateway wrapping the Rust seo-mcp binary
- **MCP Transport:** SSE (Streamable HTTP) — standard MCP remote protocol
- **Auth:** API keys (simple, fast to implement)
- **Database:** SQLite (local) or Turso (if we need edge)
- **Billing:** Lemon Squeezy (India-friendly) or Stripe
- **Frontend:** Next.js landing page + dashboard
- **Hosting:** Hetzner VPS (cheap, reliable) or Fly.io
- **Domain:** TBD (seomcp.dev? seomcp.ai? mcp-seo.com?)

## Pricing Tiers

| Plan | Price | Tool Calls/mo | Sites | Features |
|------|-------|---------------|-------|----------|
| Free | $0 | 50 | 1 | Basic tools, no history |
| Pro | $29/mo | 2,000 | 5 | Full tools, 30-day history, email reports |
| Agency | $79/mo | 10,000 | Unlimited | Team seats, 90-day history, priority |
| Enterprise | $199/mo | Unlimited | Unlimited | SLA, dedicated support, custom tools |

## MVP Scope (Ship in 5-7 days)

### Phase 1: Core API (Day 1-2)
- [ ] MCP-compliant HTTP+SSE server (remote MCP spec)
- [ ] API key auth middleware
- [ ] Rate limiting per plan
- [ ] Usage tracking (calls per key)
- [ ] Proxy requests to seo-mcp Rust binary
- [ ] Google OAuth flow for users to connect GSC/GA4

### Phase 2: Landing Page (Day 3)
- [ ] Hero + value prop
- [ ] How it works (3 steps)
- [ ] Pricing table
- [ ] Demo/playground
- [ ] Sign up flow → API key generation

### Phase 3: Dashboard (Day 4-5)
- [ ] API key management (create/revoke)
- [ ] Usage stats (calls, sites, tools used)
- [ ] Connected sites (GSC/GA4)
- [ ] Audit history & reports
- [ ] Billing management

### Phase 4: Billing (Day 5-6)
- [ ] Lemon Squeezy / Stripe integration
- [ ] Plan enforcement (rate limits, site limits)
- [ ] Upgrade/downgrade flow
- [ ] Webhooks for payment events

### Phase 5: Launch (Day 7)
- [ ] Deploy to production
- [ ] Documentation / setup guide
- [ ] X announcement thread
- [ ] Product Hunt prep
- [ ] Post on HN, Reddit /r/SEO, /r/artificial

## Post-MVP
- Historical data & trend tracking
- Scheduled automated audits
- Webhook notifications (SEO alerts)
- White-label for agencies
- Browser extension companion
- Pre-built workflows / templates
- Multi-user team support

## Competition Research (TODO)
- [ ] Check if anyone else has SEO MCP as SaaS
- [ ] Check MCP marketplace/registries
- [ ] Price comparison with existing tools
- [ ] Search X/Reddit for demand signals

## Open Questions
- Domain name?
- Lemon Squeezy vs Stripe vs both?
- Host seo-mcp binary per-user or shared multi-tenant?
- How to handle Google OAuth for users' GSC/GA4?
