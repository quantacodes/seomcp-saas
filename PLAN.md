# SEO MCP SaaS — Final Plan (v2)

**Product:** seomcp.dev
**Tagline:** "Give any AI agent SEO superpowers. Your credentials never touch our servers."
**Domain:** https://seomcp.dev (LIVE)
**Founded:** 2026-02-12
**Team:** Saurabh (Founder/Engineering), Vijay (Co-founder/Head of SEO)

---

## Architecture: Local Proxy + Cloud Backend

### Core Principle
**Zero credential storage.** User's Google keys stay on their machine. Our server processes requests in ephemeral memory, then the process dies. Nothing stored, nothing logged, nothing persisted.

### Components

#### 1. @seomcp/proxy (npm, OPEN SOURCE, ~200 lines)
- User installs: `npm i -g @seomcp/proxy` (or `npx @seomcp/proxy`)
- Runs as LOCAL stdio MCP server (Claude Desktop, Cursor, Windsurf, Cline, etc.)
- Reads Google service account JSON from user's local filesystem
- Forwards tool requests to api.seomcp.dev over HTTPS
- Attaches Google creds in encrypted request body (TLS)
- Returns results back to AI agent via stdio
- Caches tool manifest locally (tools/list served without cloud round-trip)
- Validates creds format before sending (pre-flight check)
- Open source — users can audit every line

#### 2. api.seomcp.dev (Cloud Server, CLOSED SOURCE)
- Receives HTTPS requests from proxy
- Validates API key → checks plan rate limits
- Spawns seo-mcp Rust binary per request
- Passes Google creds via stdin pipe (NOT env vars — /proc safe)
- Rust binary calls Google APIs (GSC, GA4, PageSpeed, IndexNow) with user's creds
- Returns result → process dies → creds purged from memory
- Bounded concurrency: max 10-15 concurrent spawns, 429 queue beyond
- 30-second hard timeout per request, aggressive orphan cleanup
- Core dumps DISABLED, mlock enabled, no swap
- Request bodies NEVER logged (enforced at framework level)
- Read-only filesystem for Rust binary (integrity protection)

#### 3. User's MCP Client Config
```json
{
  "mcpServers": {
    "seo-mcp": {
      "command": "seomcp-proxy",
      "env": {
        "SEOMCP_API_KEY": "sk-xxx",
        "GOOGLE_SERVICE_ACCOUNT": "./service-account.json",
        "GSC_PROPERTY": "sc-domain:example.com",
        "GA4_PROPERTY": "properties/123456"
      }
    }
  }
}
```

### Request Flow
```
User asks Claude "audit my SEO"
  → Claude calls seo-mcp tool (stdio)
    → Local proxy reads Google creds from disk
      → HTTPS POST to api.seomcp.dev
        → Server validates API key + rate limit
          → Spawns Rust binary, pipes creds via stdin
            → Rust calls Google APIs (1-15 seconds)
              → Returns result
            → Process dies, creds gone from memory
          → Response back to proxy over HTTPS
        → Proxy writes result to stdout
      → Claude shows user the SEO audit
```

### Data Residency
| Data | Location | Persisted? |
|------|----------|-----------|
| Google service account JSON | User's machine | Yes (their file) |
| API key (sk-xxx) | User's machine + our DB | Yes |
| User email, plan tier | Our DB | Yes |
| Usage counters | Our DB | Yes |
| Google creds in transit | HTTPS tunnel (TLS 1.3) | No |
| Google creds on our server | RAM only, 1-15 sec | No (process dies) |
| Request/response bodies | Nowhere | Never logged |
| seo-mcp Rust binary (35 tools) | Our server only | Yes (our IP) |

---

## Pricing

### Launch Tiers
| Plan | Price | Calls/mo | Sites | Features |
|------|-------|----------|-------|----------|
| Free | $0/forever | 100 | 1 | All 35 tools, community support |
| Pro | $19/mo | 2,000 | 5 | All tools, email support, priority queue |
| Agency | $79/mo | 10,000 | Unlimited | All tools, team seats, priority support |

### Annual Pricing (Phase 8 — move up from original Phase 9)
| Plan | Annual | Effective Monthly | Savings |
|------|--------|-------------------|---------|
| Pro | $169/yr | $14/mo | 26% off |
| Agency | $699/yr | $58.25/mo | 26% off |

### Enterprise Lite (Phase 2)
| Plan | Price | Calls/mo | Features |
|------|-------|----------|----------|
| Enterprise Lite | $149/mo | 25,000 | Priority support, SLA, dedicated queue |

### Overage (Phase 2)
- $0.02/call over monthly limit (soft cap, not hard cutoff)

### Billing
- **Lemon Squeezy** (India-friendly, handles tax/VAT globally)
- Fallback: Stripe (if LS doesn't work out)

---

## Competitive Position

| Feature | Us (seomcp.dev) | Ekamoira | FireSEO | Findable | @houtini |
|---------|----------------|----------|---------|----------|----------|
| Real MCP server | ✅ | ✅ | ❌ (down) | ❌ (web only) | ✅ |
| Tools count | 35 | ~12 | ? | 10 | 1 |
| Cred storage | ❌ Never | ✅ OAuth DB | ✅ Supabase | ✅ Stored | N/A (local) |
| GSC tools | 8 | 7 | ? | 1 | 0 |
| GA4 tools | 9 | 0 | 0 | 0 | 0 |
| IndexNow | 4 | 0 | 0 | 0 | 0 |
| Site auditing | ✅ | ❌ | ✅ | ❌ | ✅ |
| Schema validation | ✅ | ❌ | ❌ | ❌ | ❌ |
| generate_report | ✅ (1 cmd full audit) | ❌ | ❌ | ❌ | ❌ |
| Price | $29/mo | $79 lifetime | Free? | €199/mo | Free |
| Open source proxy | ✅ | ❌ | ❌ | ❌ | ✅ (all) |

### Our Edge
1. **35 tools** — most comprehensive MCP SEO toolkit
2. **Zero cred storage** — only one that can claim this
3. **Open source proxy** — full transparency + trust
4. **$29/mo** — 7x cheaper than Findable, more tools than everyone

---

## MVP Build Plan (4-5 days)

### Phase 1: Proxy Package (Day 1)
- [ ] Create @seomcp/proxy npm package (~200 lines)
- [ ] JSON-RPC stdin/stdout forwarding
- [ ] Local cred reading + validation
- [ ] HTTPS forwarding to api.seomcp.dev
- [ ] Tool manifest caching (serve tools/list locally)
- [ ] Error handling + structured error responses
- [ ] `seomcp-proxy test` command (validate creds + API key + connectivity)
- [ ] `seomcp-proxy init` interactive setup wizard (stretch)

### Phase 2: Cloud API (Day 2-3)
- [ ] HTTP server (Bun/Fastify or Actix-web)
- [ ] API key auth middleware
- [ ] Rate limiting per plan (in-memory or Redis)
- [ ] Usage tracking (calls per key per month)
- [ ] Per-request Rust binary spawning
- [ ] Stdin cred piping (NOT env vars)
- [ ] 30s request timeout + orphan process cleanup
- [ ] Bounded concurrency pool (max 15 concurrent)
- [ ] Security hardening: no core dumps, mlock, no swap, no body logging
- [ ] Read-only binary filesystem
- [ ] Error taxonomy + structured responses
- [ ] Version endpoint (proxy compatibility check)
- [ ] Health check endpoint

### Phase 3: Cross-compile + Deploy (Day 3)
- [ ] Cross-compile seo-mcp Rust binary for linux-amd64
- [ ] Fly.io deployment (1GB RAM VM, $7/mo)
- [ ] Custom domain: api.seomcp.dev
- [ ] SSL/TLS configuration
- [ ] Smoke test all 35 tools end-to-end

### Phase 4: Billing + Auth (Day 4)
- [ ] User signup flow (email + password or magic link)
- [ ] API key generation (sk-xxx format)
- [ ] Lemon Squeezy integration (checkout + webhooks)
- [ ] Plan enforcement (rate limits per tier)
- [ ] Simple dashboard (API key, usage stats, plan management)

### Phase 5: Onboarding + Docs + Landing (Day 5)
- [ ] Signup → API key generation flow
- [ ] Setup guide with screenshots (Google service account walkthrough)
- [ ] Tool reference documentation (all 35 tools)
- [ ] Troubleshooting guide
- [ ] Update seomcp.dev landing page with final copy
- [ ] SEO fixes: og:image (with logo), robots.txt, sitemap
- [ ] Deploy to production

### Phase 6: Buffer + Launch (Day 6)
- [ ] Product Hunt submission
- [ ] X/Twitter announcement thread
- [ ] HN Show HN post
- [ ] Reddit: r/SEO, r/artificial, r/SideProject
- [ ] Dev.to / Hashnode blog post
- [ ] Vijay's SEO network outreach

---

## Post-MVP Roadmap

### Phase 7: OAuth Onboarding (Week 2-3)
- [ ] Create Google Cloud OAuth project
- [ ] Submit for Google verification
- [ ] Implement OAuth flow in proxy (local token storage)
- [ ] "Sign in with Google" → proxy handles OAuth dance
- [ ] Refresh token stored on user's machine only
- [ ] Service accounts = "advanced mode", OAuth = "easy mode"

### Phase 8: Premium Cloud Features (Week 3-4)
- [ ] Historical audit data + trend tracking (SQLite/Turso)
- [ ] Scheduled automated audits (cron)
- [ ] Email reports (weekly SEO digest via Resend)
- [ ] Webhook notifications (SEO alerts)
- [ ] Multi-tool batch requests

### Phase 9: Growth (Month 2)
- [ ] Annual pricing tiers
- [ ] Usage overage billing ($0.02/call over limit)
- [ ] Team seats for Agency plan
- [ ] White-label for agencies
- [ ] Browser extension companion
- [ ] Pre-built workflow templates
- [ ] SOC2 Type 1 prep (when hitting $10K MRR)

### Phase 10: Scale (Month 3+)
- [ ] Auto-scaling on Fly.io (scale-to-zero + on-demand)
- [ ] Multi-region deployment
- [ ] Refactor Rust binary to long-running server (eliminate spawn overhead)
- [ ] API versioning for backward compatibility
- [ ] Enterprise tier ($199/mo) with SLA + dedicated support
- [ ] Blog + content marketing
- [ ] Backlink building

---

## Security Commitments

### What We Claim (honest, defensible)
- ✅ "Your credentials are never stored on our servers"
- ✅ "They exist in memory only for the duration of your request (1-15 sec), then the process is destroyed"
- ✅ "Never written to disk, never logged, never in any database"
- ✅ "Even if our server is breached, attackers can't access past credentials — they don't exist"
- ✅ "Open-source proxy — audit every line"

### What We DON'T Claim
- ❌ "Impossible to leak" (a compromised server could intercept in-flight)
- ❌ "Unhackable" (nothing is)

### Technical Safeguards
1. Creds via stdin pipe, NOT env vars
2. Core dumps disabled (ulimit -c 0)
3. Memory locking (mlock/mlockall)
4. No swap on production VM
5. Request bodies never logged (framework-level enforcement)
6. Read-only filesystem for Rust binary
7. 30-second hard timeout + orphan cleanup
8. Bounded concurrency (max 15)
9. npm 2FA + provenance attestation on proxy package
10. Binary integrity hash-check on spawn

---

## Unit Economics

### Costs
| Item | Monthly |
|------|---------|
| Fly.io VM (1GB) | $7 |
| Domain (seomcp.dev) | ~$5 (amortized) |
| Lemon Squeezy fees | 5% + $0.50/txn |
| Resend email (Phase 8) | Free tier → $20/mo |

### Revenue Projections
| Milestone | Users | MRR | Profit |
|-----------|-------|-----|--------|
| Month 1 | 10 Pro, 2 Agency | $448 | ~$400 |
| Month 3 | 50 Pro, 10 Agency | $2,240 | ~$2,100 |
| Month 6 | 200 Pro, 30 Agency | $8,170 | ~$7,800 |
| Month 12 | 500 Pro, 80 Agency | $20,820 | ~$19,500 |

### Capacity
- Single $7 VM: handles ~100 Pro users (avg 5 calls/day)
- Scale trigger: >50 concurrent requests sustained → add second VM ($14/mo)
- Google API quotas: user's own project, not our problem

---

## Open Items
- [ ] Logo selection (5 SVG concepts sent, awaiting feedback)
- [ ] Legal consult on Google ToS for service account proxying ($300, pre-launch recommended)
- [ ] Vijay co-founder terms (equity split, bandwidth, beta customers)
- [ ] Video walkthrough script
- [ ] npm package name availability (@seomcp/proxy)

---

## Key Files
| What | Path |
|------|------|
| Landing page | src/landing/index.html |
| Design brief | DESIGN-BRIEF.md |
| Logo concepts | logos/ (5 SVGs + preview.html) |
| Rust binary source | ~/clawd/projects/seo-mcp/ |
| Competitor intel | ~/clawd/memory/competitors-seomcp.md |
| SEO roadmaps | ~/clawd/memory/hnn-seo-roadmap.md, qc-seo-roadmap.md |

---

*Ship fast. Ship honest. Ship secure.* 🦀
