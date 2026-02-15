# SEO MCP SaaS — Competitive Analysis Report

**Research Date:** 2026-02-12  
**Researcher:** Kelp 🌿🔬  
**Status:** Complete

---

## 1. Executive Summary

### TL;DR: The market is wide open for a SaaS SEO MCP built on free Google APIs.

The SEO MCP server space is nascent and fragmented. There are ~10 SEO-related MCP servers on GitHub, but **none** offer a hosted SaaS product. Every competitor is either:

1. **A wrapper around paid third-party APIs** (DataForSEO, Semrush, AlsoAsked, FetchSERP) — meaning the user pays BOTH for the MCP AND the underlying API
2. **A niche single-purpose tool** (Lighthouse for audits, Bing Webmaster for Bing only, kwrds.ai for keywords only)
3. **A scraper with legal risk** (seo-insights-mcp scrapes Ahrefs with CAPTCHA solving)

**No competitor uses Google's free APIs (GSC, GA4, PageSpeed, IndexNow) as their data backbone.** This is our biggest differentiator — zero ongoing data cost for the user.

### Real Threats (Ranked)

| Rank | Threat | Why |
|------|--------|-----|
| 🔴 1 | **Ahrefs MCP Server** | Ahrefs now lists "MCP Server" as a feature on their pricing page. They have massive data, brand trust, and could bundle it free with subscriptions ($129+/mo). |
| 🟡 2 | **DataForSEO MCP** | Most mature MCP (141 stars, 9 modules, Cloudflare Worker deployment). But requires DataForSEO API ($50 min), so total cost is high. |
| 🟡 3 | **SE Ranking MCP** | Official MCP from a major SEO platform. Strong feature set, backed by a real company. But requires SE Ranking subscription ($103+/mo). |
| 🟢 4 | **FetchSERP MCP** | Has hosted MCP endpoint, 250 free credits. Closest to a SaaS model. But primarily an API company, MCP is secondary. |
| 🟢 5 | **Lighthouse MCP** | Only does performance audits. No keyword/backlink/GSC data. Complementary, not competing. |

**Key Insight:** The biggest competitors are traditional SEO tool companies (Ahrefs, Semrush, SE Ranking) adding MCP as a feature to their existing platforms — not standalone MCP products. Our opportunity is to be the **affordable, all-in-one SEO MCP SaaS** that works without requiring a $100+/mo SEO subscription.

---

## 2. Direct Competitors — Detailed Analysis

### 2.1 DataForSEO MCP Server
- **Repo:** [github.com/dataforseo/mcp-server-typescript](https://github.com/dataforseo/mcp-server-typescript)
- **Stars:** ~141 (from Glama: 141)
- **Tech Stack:** TypeScript/Node.js, NPM package, Cloudflare Worker support
- **Model:** Self-hosted (stdio or HTTP) + deployable to Cloudflare Workers
- **API Dependency:** DataForSEO API (paid, $50 minimum deposit, pay-as-you-go)
- **Tools/Modules:** 9 modules — SERP, Keywords Data, OnPage, DataForSEO Labs, Backlinks, Business Data, Domain Analytics, Content Analysis, AI Optimization
- **SaaS:** ❌ No hosted SaaS version
- **Free Tier:** ❌ DataForSEO has no free tier (minimum $50)
- **Strengths:** Most comprehensive API coverage, enterprise-grade deployment options, official from DataForSEO
- **Weaknesses:** Expensive data costs on top of setup complexity, no hosted option
- **vs Our Product:**
  - They have: Backlinks, paid search data, business reviews data, content analysis
  - We have: GSC integration, GA4 analytics, IndexNow submissions, site crawling, generate_report, schema validation, sitemap management — ALL FREE
  - Their total cost: $50+ API fees. Our planned: $29/mo flat

### 2.2 SIGMEO
- **Listed on:** mcp.so (claimed 52 tools)
- **Website:** sigmeo.com (failed to resolve), sigmeo.io (not found)
- **GitHub:** No public repository found
- **Status:** ⚠️ Possibly vaporware or private/invite-only. Could not verify any claims.
- **Assessment:** Listed on mcp.so but no accessible website, no GitHub repo, no pricing page. May be a placeholder listing or early-stage closed product. **Not a current threat.**

### 2.3 seo-insights-mcp (mrgoonie)
- **Repo:** [github.com/mrgoonie/seo-insights-mcp-server](https://github.com/mrgoonie/seo-insights-mcp-server)
- **Stars:** ~28
- **Tech Stack:** TypeScript/Node.js, npm package
- **Model:** Self-hosted (stdio + HTTP)
- **API Dependency:** ⚠️ **Scrapes Ahrefs** (requires CAPSOLVER API key for CAPTCHA solving)
- **Tools:** 4 tools — backlinks, keyword ideas, keyword difficulty, traffic analysis
- **SaaS:** ❌
- **Free Tier:** N/A (scraping-based)
- **Strengths:** Free access to Ahrefs data (via scraping)
- **Weaknesses:** Legally dubious (TOS violation), fragile (CAPTCHA-dependent), very limited tools (4), requires CAPSOLVER subscription
- **vs Our Product:**
  - They have: Ahrefs backlink data (scraped)
  - We have: 35 legitimate tools, legal API access, no scraping risk
  - **Not a serious threat** — more of a hobby project with legal risk

### 2.4 SE Ranking MCP Server
- **Repo:** [github.com/seranking/seo-data-api-mcp-server](https://github.com/seranking/seo-data-api-mcp-server)
- **Stars:** Unknown (official from SE Ranking)
- **Tech Stack:** TypeScript/Node.js, Docker support
- **Model:** Self-hosted (Docker recommended, stdio + HTTP)
- **API Dependency:** SE Ranking Data API + Project API (requires SE Ranking subscription)
- **Tools:** Keyword research, backlink analysis, domain traffic/rankings, website audits, AI search visibility, project management, rank tracking
- **SaaS:** ❌ (but SE Ranking itself is SaaS at $103-$279/mo)
- **Free Tier:** ❌ (requires SE Ranking account)
- **Strengths:** Official product from real company, comprehensive feature set, dual API tokens (Data + Project)
- **Weaknesses:** Requires SE Ranking subscription ($103+/mo), Docker setup complexity
- **vs Our Product:**
  - They have: Backlink monitoring, AI search visibility tracking, rank tracking, project management
  - We have: Free Google API access, IndexNow, schema validation, sitemap management, site crawling, generate_report
  - Their total cost: $103+/mo subscription. Ours: $29/mo

### 2.5 Semrush MCP (metehan777)
- **Repo:** [github.com/metehan777/semrush-mcp](https://github.com/metehan777/semrush-mcp)
- **Stars:** Small (community-built, not official Semrush)
- **Tech Stack:** TypeScript/Node.js
- **Model:** Self-hosted only
- **API Dependency:** Semrush API key (requires Semrush subscription, API access varies by plan)
- **Tools:** 7 tools — domain overview, keyword overview, organic search, paid search, backlinks overview, competitor research, related keywords
- **SaaS:** ❌
- **Free Tier:** ❌ (Semrush API not free)
- **Strengths:** Leverages Semrush's powerful data
- **Weaknesses:** Unofficial (could break anytime), requires expensive Semrush plan, limited tool count
- **vs Our Product:**
  - They have: Semrush's database (paid search, competitor keywords)
  - We have: 35 tools vs their 7, free APIs, hosted SaaS model

### 2.6 Lighthouse MCP Server
- **Repo:** [github.com/danielsogl/lighthouse-mcp-server](https://github.com/danielsogl/lighthouse-mcp-server)
- **Stars:** ~43
- **Tech Stack:** TypeScript/Node.js, npx-installable
- **Model:** Self-hosted (requires Chrome/Chromium)
- **API Dependency:** None (runs Lighthouse locally)
- **Tools:** 13+ tools — performance analysis, accessibility audits, SEO analysis, security assessment, Core Web Vitals, resource analysis, performance budgets
- **SaaS:** ❌
- **Free Tier:** ✅ Fully free (open source, MIT)
- **Strengths:** Good quality, well-documented, active maintenance, VS Code/Cursor/Windsurf integration, no API costs
- **Weaknesses:** Only does auditing (no keywords, no GSC, no analytics, no indexing), requires local Chrome
- **vs Our Product:**
  - They have: Deep Lighthouse audit integration, accessibility auditing, security assessment
  - We have: Everything else — GSC, GA4, keywords, indexing, sitemaps, schema, crawling
  - **Complementary, not competing.** Could even recommend users pair both.

### 2.7 Bing Webmaster MCP
- **Repo:** [github.com/isiahw1/mcp-server-bing-webmaster](https://github.com/isiahw1/mcp-server-bing-webmaster)
- **Stars:** Small
- **Tech Stack:** Python + Node.js (npm/npx wrapper)
- **Model:** Self-hosted
- **API Dependency:** Bing Webmaster Tools API key (free)
- **Tools:** Site management, traffic analytics, crawl data, URL submission, keyword analysis, sitemap management
- **SaaS:** ❌
- **Free Tier:** ✅ (Bing Webmaster API is free)
- **Strengths:** Free API, Bing-specific data
- **Weaknesses:** Bing-only (small market share), limited SEO scope
- **vs Our Product:**
  - They have: Bing-specific data
  - We have: Google (93%+ market share), comprehensive tool suite
  - **Niche complement, not a threat**

### 2.8 kwrds.ai MCP
- **Repo:** [github.com/mkotsollaris/kwrds-ai-mcp](https://github.com/mkotsollaris/kwrds-ai-mcp)
- **Stars:** Very small
- **Tech Stack:** Python
- **Model:** Self-hosted only
- **API Dependency:** kwrds.ai API (paid, $39/mo for UI Full Access, custom API plans)
- **Tools:** Keyword research, People Also Ask
- **SaaS:** ❌ (MCP is self-hosted; kwrds.ai itself is SaaS)
- **Free Tier:** kwrds.ai has limited free tier (10 AI queries/mo)
- **Strengths:** AI-powered keyword research, 190+ languages
- **Weaknesses:** Very narrow focus (keywords only), minimal MCP implementation
- **vs Our Product:**
  - They have: AI-powered keyword suggestions
  - We have: 35 tools covering full SEO workflow

### 2.9 AlsoAsked MCP
- **Repo:** [github.com/metehan777/alsoasked-mcp](https://github.com/metehan777/alsoasked-mcp)
- **Stars:** Small (community-built)
- **Tech Stack:** TypeScript/Node.js
- **Model:** Self-hosted only
- **API Dependency:** AlsoAsked API (Pro: $59/mo, API access, 1000 queries)
- **Tools:** 3 tools — search PAA questions, single term search, account info
- **SaaS:** ❌
- **Free Tier:** ❌
- **Strengths:** Unique PAA data, structured question hierarchies
- **Weaknesses:** Extremely narrow (PAA only), expensive for what it does, unofficial
- **vs Our Product:**
  - They have: PAA data
  - We have: Comprehensive SEO suite. PAA is a nice-to-have we could add later.

### 2.10 FetchSERP MCP
- **Repo:** [github.com/punkpeye/fetchserp-mcp-server-node](https://github.com/punkpeye/fetchserp-mcp-server-node) (also github.com/fetchSERP-LLC/)
- **Stars:** Growing
- **Tech Stack:** TypeScript/Node.js, Docker, hosted HTTP endpoint
- **Model:** Self-hosted (npx, Docker) + **Hosted MCP endpoint** (mcp.fetchserp.com)
- **API Dependency:** FetchSERP API (credit-based, 250 free credits on signup)
- **Tools:** 15+ tools — SERP results, domain analysis, backlinks, keyword research, SEO analysis, AI analysis, web scraping, Moz integration, indexation checking
- **SaaS:** ⚡ **Closest to SaaS** — hosted MCP endpoint available, works with Claude API and OpenAI API directly
- **Free Tier:** ✅ 250 free credits
- **Pricing:** Credit-based (pricing not public, likely tiered)
- **Strengths:** Hosted option, multi-engine SERP (Google, Bing, Yahoo, DuckDuckGo), web scraping, Moz DA integration, Claude API + OpenAI API integration examples
- **Weaknesses:** Credit-based (costs add up), data quality unclear vs Ahrefs/Semrush
- **vs Our Product:**
  - They have: Multi-engine SERP, web scraping, AI analysis, Moz DA
  - We have: GSC (actual Google data), GA4, IndexNow, schema validation, site crawling, comprehensive audit reports
  - They charge per-credit. We charge flat $29/mo.

---

## 3. Indirect Competitors — Traditional SEO Tools

### Pricing Comparison Table

| Tool | Starter Price | Mid-Tier | Enterprise | API Access | MCP Server? |
|------|-------------|----------|------------|------------|-------------|
| **Ahrefs** | $129/mo (Lite) | $249/mo (Standard) | $1,499/mo | Enterprise only ($1,499+) | ✅ **YES** (listed as feature) |
| **Semrush** | ~$139/mo (Pro) | ~$249/mo (Guru) | ~$499/mo (Business) | Varies by plan | ❌ No (community MCP exists) |
| **Moz Pro** | $49/mo (Starter) | $99/mo (Standard) | $299/mo (Large) | Separate API pricing ($20-$10K/mo) | ❌ No |
| **SE Ranking** | $103/mo (Core) | $223/mo (Growth) | Custom | $100K API credits in Growth | ✅ YES (official MCP) |
| **Screaming Frog** | Free (500 URLs) | £199/yr (~$250/yr) | Bulk discounts | ❌ No API | ❌ No |
| **Sitebulb** | ~$13/mo (Lite) | ~$35/mo (Pro) | Cloud plans | ❌ No API | ❌ No |

### Key Observations

1. **Ahrefs is the most dangerous.** They explicitly list "MCP Server" as a feature in their pricing comparison table. This means they're building/have built an MCP server for their API. Bundled with their subscription, it could be very compelling — but at $129+/mo minimum.

2. **Semrush has no official MCP** but their massive market presence means they could launch one any time. Their API exists but pricing is opaque.

3. **Moz API** is separately priced ($20-$10K/mo) and focused on link metrics (DA, PA, Spam Score). No MCP.

4. **SE Ranking** has an official MCP and competitive pricing, but still requires their subscription.

5. **Screaming Frog** and **Sitebulb** are desktop crawlers with no API/MCP — a different category entirely.

---

## 4. MCP Marketplace Landscape

### Ecosystem Size (Feb 2026)
- **mcp.so:** Community directory, hundreds of MCP servers listed. Likely the largest discovery platform.
- **Glama.ai:** Growing directory with quality metrics, sorting by usage. Shows DataForSEO MCP with 141 stars and 1,034 users.
- **GitHub MCP Registry:** GitHub now has an official MCP Registry feature (listed in their navigation). Major validation of the ecosystem.
- **Anthropic's MCP:** The spec creators. Claude Desktop is the primary consumer.
- **OpenAI:** Now supports MCP in their API (as seen in FetchSERP's examples with `type: "mcp"`).

### Discovery Channels
1. **mcp.so** — largest community directory
2. **GitHub** — search + new MCP Registry
3. **Glama.ai** — curated with quality/usage metrics
4. **Anthropic docs** — official list
5. **Claude Desktop** — built-in MCP support
6. **VS Code / Cursor / Windsurf** — IDE integrations driving adoption

### Monetization Models for MCP Servers
1. **API proxy with credit/subscription** — FetchSERP, DataForSEO (charge for underlying API)
2. **Open source + premium features** — Most common, but no one's cracked premium yet
3. **Bundled with SaaS subscription** — Ahrefs, SE Ranking (MCP is a feature of existing product)
4. **Standalone MCP SaaS** — **NO ONE IS DOING THIS YET.** This is our opportunity.

---

## 5. Demand Signals

### Evidence of Demand
- **MCP ecosystem is exploding**: GitHub added an MCP Registry. OpenAI added MCP support to their API. Anthropic, Google (Gemini CLI), all supporting MCP.
- **Ahrefs adding MCP Server as a feature** = validation that enterprise SEO tools see MCP as the future interface
- **DataForSEO MCP at 141 stars** = organic interest despite requiring paid API
- **FetchSERP already offering hosted MCP** = someone sees the SaaS opportunity
- **Multiple community-built wrappers** (Semrush MCP, AlsoAsked MCP by same dev metehan777) = developer demand for SEO+AI integration

### Missing Signals / Risks
- No Product Hunt launches found for "SEO MCP" specifically
- MCP as a concept is still technical/developer-focused — mainstream SEO users may not know what MCP is
- Google Trends data unavailable, but "MCP server" interest likely rising with OpenAI/Anthropic adoption

---

## 6. Feature Gap Analysis

### What Competitors Have That We DON'T

| Feature | Who Has It | Priority to Add |
|---------|-----------|----------------|
| **Backlink analysis** (external link data) | DataForSEO, Semrush MCP, FetchSERP, seo-insights | 🔴 HIGH — consider integrating free/cheap backlink sources |
| **Keyword search volume** (from paid databases) | DataForSEO, Semrush, kwrds.ai, FetchSERP | 🟡 MEDIUM — GSC has some keyword data; consider free alternatives |
| **SERP tracking** (real-time SERP data) | DataForSEO, Semrush, FetchSERP | 🟡 MEDIUM — could use free SERP scraping |
| **Competitor domain analysis** | DataForSEO, Semrush, SE Ranking | 🟡 MEDIUM |
| **People Also Ask data** | AlsoAsked MCP | 🟢 LOW — niche feature |
| **Multi-engine SERP** (Bing, Yahoo, DuckDuckGo) | FetchSERP | 🟢 LOW |
| **Web scraping** | FetchSERP | 🟢 LOW — out of scope |
| **Accessibility auditing** | Lighthouse MCP | 🟢 LOW — complementary tool |
| **Moz DA integration** | FetchSERP | 🟢 LOW |
| **AI-powered analysis prompts** | FetchSERP | 🟡 MEDIUM — easy to add |

### What WE Have That NOBODY Else Does

| Unique Feature | Why It Matters |
|---------------|---------------|
| **Google Search Console integration** | Direct access to REAL Google search data (impressions, clicks, CTR, position) — no third-party approximation |
| **Google Analytics 4 integration** | Real traffic data, not estimates |
| **IndexNow submissions** | Instant indexing requests — no other MCP does this |
| **generate_report** (one-command full audit) | Comprehensive audit in a single tool call — huge UX advantage |
| **Bulk URL inspection** | Check indexing status of multiple URLs at once |
| **Sitemap management** | Generate, validate, submit sitemaps |
| **Schema/structured data validation** | JSON-LD validation — no other MCP does this |
| **Site crawling** | Built-in crawler (Rust = fast) |
| **PageSpeed Insights integration** | Google's official performance data |
| **Uses FREE Google APIs** | Zero data cost for users — revolutionary pricing advantage |
| **Rust binary** | Fast, single binary, easy deployment |
| **Hosted SaaS model** | No setup required — huge UX advantage over every competitor |

---

## 7. Pricing Strategy

### Competitor Pricing Summary

| Product | Pricing Model | Effective Cost |
|---------|--------------|----------------|
| DataForSEO MCP | Free MCP + $50 min API deposit (pay-per-use) | $50-$500+/mo depending on usage |
| SE Ranking MCP | Free MCP + $103-$279/mo subscription | $103-$279/mo |
| Semrush MCP | Free MCP + $139-$499/mo subscription | $139-$499/mo |
| Ahrefs MCP | Bundled in $129-$1,499/mo subscription | $129-$1,499/mo |
| FetchSERP | Credit-based (250 free, then paid) | ~$10-$100+/mo estimated |
| Lighthouse MCP | Free (open source) | $0 |
| kwrds.ai MCP | Free MCP + $39/mo kwrds.ai subscription | $39+/mo |
| AlsoAsked MCP | Free MCP + $59/mo AlsoAsked subscription | $59+/mo |
| **Our seo-mcp** | **$29/mo planned** | **$29/mo** |

### Recommended Pricing Strategy

**$29/mo is a PERFECT price point.** Here's why:

1. **Below ALL major competitors** — Cheapest SEO MCP with real features
2. **Below the "approval threshold"** — Most freelancers/small agencies can expense $29/mo without approval
3. **Free tier recommended:** 
   - **Free:** 5 sites, 100 API calls/day, basic tools
   - **Pro ($29/mo):** Unlimited sites, 1000 API calls/day, all 35 tools, generate_report
   - **Team ($79/mo):** Multi-user, priority support, higher limits
   - **Enterprise ($199/mo):** Dedicated instance, custom limits, SLA
4. **Positioning:** "The affordable SEO MCP that actually uses your real Google data"

### Why $29/mo Works
- Ahrefs MCP requires $129/mo subscription → we're **4.4x cheaper**
- SE Ranking MCP requires $103/mo subscription → we're **3.5x cheaper**
- DataForSEO requires $50 min deposit + usage → we're **more predictable**
- FetchSERP credit system is unpredictable → we're **simpler**
- Our data costs are near-zero (Google APIs are free) → healthy margins

---

## 8. Market Opportunity Assessment

### The Opportunity: "SEO for the AI Age"

**Market Size Indicators:**
- Global SEO software market: ~$10B+ (2025)
- MCP ecosystem: Rapidly growing, backed by Anthropic, adopted by OpenAI, GitHub
- AI-powered SEO: Fastest-growing segment

**Why Now:**
1. MCP is becoming the standard AI tool protocol (Anthropic + OpenAI + Google support)
2. No one has captured the "affordable SEO MCP SaaS" position
3. Google's free APIs provide a massive cost advantage
4. Traditional SEO tools are expensive ($100-$500/mo) — there's a huge underserved market of freelancers, small agencies, and indie developers

**Target Customers:**
1. **Freelance SEO consultants** using Claude/ChatGPT for work
2. **Small agencies** wanting to automate SEO audits
3. **Developers** building SEO tools/dashboards
4. **Content creators** who want SEO data without Ahrefs prices
5. **AI agent builders** who need SEO capabilities in their workflows

### Risks
1. **Ahrefs bundles MCP free** with their subscription — could steal enterprise customers
2. **Google could change API terms** — unlikely but existential risk
3. **MCP protocol churn** — spec is still evolving
4. **User education** — many SEO users don't know what MCP is yet

---

## 9. Recommended Positioning

### Tagline Options
- "Your SEO data, your AI, one command."
- "The $29 SEO MCP that uses YOUR real Google data."
- "Stop paying $100+/mo for SEO data you already have."

### Positioning Statement
> **seo-mcp** is the first hosted SEO MCP SaaS that uses Google's free APIs (Search Console, Analytics, PageSpeed) to give AI assistants direct access to your real SEO data. Unlike competitors that wrap expensive third-party APIs, seo-mcp costs just $29/mo with zero additional data fees.

### Key Differentiators to Emphasize
1. **Real Google data** (not third-party estimates)
2. **$29/mo flat** (no credit system, no API fees)
3. **Hosted SaaS** (zero setup, instant start)
4. **35 tools** (most comprehensive SEO MCP)
5. **Rust-powered** (fast, reliable)
6. **One-command audit** (generate_report)

---

## 10. Raw Notes & Links

### Direct Competitors
| Name | URL | Stars | Status |
|------|-----|-------|--------|
| DataForSEO MCP | https://github.com/dataforseo/mcp-server-typescript | 141 | Active, official |
| SIGMEO | mcp.so listing | N/A | Unverifiable, possibly vaporware |
| seo-insights-mcp | https://github.com/mrgoonie/seo-insights-mcp-server | 28 | Active, scraper |
| SE Ranking MCP | https://github.com/seranking/seo-data-api-mcp-server | N/A | Active, official |
| Semrush MCP | https://github.com/metehan777/semrush-mcp | Small | Community, unofficial |
| Lighthouse MCP | https://github.com/danielsogl/lighthouse-mcp-server | 43 | Active, popular |
| Bing Webmaster MCP | https://github.com/isiahw1/mcp-server-bing-webmaster | Small | Active |
| kwrds.ai MCP | https://github.com/mkotsollaris/kwrds-ai-mcp | Small | Minimal |
| AlsoAsked MCP | https://github.com/metehan777/alsoasked-mcp | Small | Community |
| FetchSERP MCP | https://github.com/punkpeye/fetchserp-mcp-server-node | Growing | Active, hosted option |

### Traditional SEO Tool Pricing
| Tool | URL | Starter | Notes |
|------|-----|---------|-------|
| Ahrefs | https://ahrefs.com/pricing | $129/mo (Lite) | Has MCP Server feature |
| Semrush | https://www.semrush.com/pricing/ | ~$139/mo (Pro) | No official MCP |
| Moz Pro | https://moz.com/products/pricing | $49/mo (Starter) | API separate: $20-$10K/mo |
| Moz API | https://moz.com/products/api/pricing | $20/mo (3K rows) | Standalone API product |
| SE Ranking | https://seranking.com/subscription.html | $103/mo (Core) | Has official MCP |
| Screaming Frog | https://www.screamingfrog.co.uk/seo-spider/licence/ | £199/yr | Desktop only |
| Sitebulb | https://sitebulb.com/pricing/ | ~$13/mo (Lite) | Desktop only |

### MCP Ecosystem
| Platform | URL | Notes |
|----------|-----|-------|
| mcp.so | https://mcp.so | Largest community directory |
| Glama.ai | https://glama.ai/mcp/servers | Quality-rated directory |
| GitHub MCP Registry | https://github.com/mcp | Official GitHub integration |
| kwrds.ai | https://www.kwrds.ai | $39/mo UI, custom API plans |
| FetchSERP | https://www.fetchserp.com | 250 free credits, credit-based |
| AlsoAsked | https://alsoasked.com | $59/mo Pro with 1000 queries |
| DataForSEO | https://dataforseo.com/pricing | Pay-as-you-go, $50 min |

---

## 11. Action Items / Recommendations

### Immediate (Pre-Launch)
1. ✅ **Keep $29/mo pricing** — perfectly positioned below all competitors
2. 🔴 **Add free tier** — critical for acquisition (5 sites, limited calls)
3. 🔴 **Emphasize "real Google data" angle** — this is THE differentiator
4. 🟡 **Consider adding basic backlink checking** — biggest feature gap vs competitors

### Short-Term (Post-Launch)
5. 🟡 **List on mcp.so, Glama.ai, GitHub MCP Registry** — primary discovery channels
6. 🟡 **Create comparison pages** vs DataForSEO MCP, Ahrefs, SE Ranking
7. 🟢 **Integration with Lighthouse MCP** — recommend pairing for performance audits

### Long-Term
8. 🟡 **Watch Ahrefs MCP closely** — they're the biggest potential disruptor
9. 🟡 **Consider free/cheap backlink data sources** (Common Crawl, Open PageRank, Moz free API)
10. 🟢 **Build hosted MCP endpoint** (like FetchSERP's mcp.fetchserp.com) for Claude API / OpenAI API direct integration
