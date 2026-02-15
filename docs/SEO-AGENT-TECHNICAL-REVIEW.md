# SEO Agent as a Service — Deep Technical Review

**Document Version:** 1.0  
**Date:** 2026-02-14  
**Author:** Kelp (Research Agent)  
**Review Type:** Architecture & Feasibility Assessment

---

## Executive Summary

This document evaluates building an **autonomous SEO agent product** on our existing infrastructure. The product vision: customers talk to a Telegram/Slack bot that runs 24/7 doing SEO work autonomously — daily audits, indexing submissions, alerting on issues, and (eventually) auto-fixing problems.

**Key Findings:**

1. **Competitive Gap:** No true "autonomous SEO agents" exist in market. Competitors are AI SEO *tools* requiring human operation. We would be first-to-market with a genuine autonomous agent.

2. **Architecture Recommendation:** **Hybrid (Option 3)** — Shared OpenClaw + seo-mcp compute with per-customer isolated data/config/bots. Best balance of cost efficiency and customer isolation.

3. **Cost Estimate:** $2-4/customer/month infrastructure + ~$3-8/customer/month LLM tokens = **$5-12/customer/month total cost** at the hybrid architecture.

4. **MVP Timeline:** 4-6 weeks to production-ready MVP leveraging existing infrastructure.

5. **Verdict:** **GO** with high confidence (85%). Clear product-market fit opportunity, reasonable build complexity, strong unit economics.

---

## Table of Contents

1. [Competitive Landscape](#1-competitive-landscape)
2. [Architecture Deep Dive](#2-architecture-deep-dive)
3. [OpenClaw Multi-Tenant Research](#3-openclaw-multi-tenant-research)
4. [Telegram Bot Architecture](#4-telegram-bot-architecture)
5. [Google Credentials Management](#5-google-credentials-management)
6. [Cost Model](#6-cost-model)
7. [MVP Technical Specification](#7-mvp-technical-specification)
8. [Risk Register](#8-risk-register)
9. [Timeline Estimate](#9-timeline-estimate)
10. [Verdict & Recommendations](#10-verdict--recommendations)

---

## 1. Competitive Landscape

### 1.1 Existing SEO Agents/Bots

**Finding: No true autonomous SEO agents exist in market.**

After extensive research, I found zero products that match our vision of a 24/7 autonomous SEO agent that:
- Runs continuously without human prompting
- Proactively audits, monitors, and alerts
- Takes autonomous actions (indexing submissions, etc.)
- Communicates via messaging channels (Telegram/Slack)

**What exists instead:** AI-powered SEO *tools* that still require human operation.

### 1.2 AI SEO Platforms Analysis

| Platform | What It Does | What It Doesn't Do | Pricing |
|----------|--------------|-------------------|---------|
| **SEO.AI** | Autopilot content: keyword research, writes articles, publishes to CMS, backlink outreach | No technical SEO, no GSC/GA4 integration, no autonomous monitoring | $149-299/mo |
| **Frase** | Agentic SEO: research, writing, optimization, publishing to WordPress | No autonomous operation, no indexing, no technical audits | $19-99/mo (self-serve) |
| **Surfer SEO** | Content optimization, NLP-based scoring, SERP analysis | Manual operation, no agent, no automation beyond content | $89-399/mo |
| **MarketMuse** | Content planning, topic authority analysis, gap detection | No execution, no automation, planning/audit only | Enterprise (hidden pricing) |
| **Ahrefs** | Traditional SEO tools: backlinks, keyword research, site audit | No AI, no agent, no autonomous operation | $99-999/mo |
| **Semrush** | All-in-one SEO toolkit with some automation | No agent, no messaging, requires human operation | $129-499/mo |

**Key Insight:** These tools are content-focused AI assistants, not technical SEO agents. None of them:
- Monitor GSC/GA4 continuously
- Submit to IndexNow automatically
- Run schema validation
- Alert on indexing drops or CWV regressions
- Operate through messaging channels

### 1.3 Agent-as-a-Service Platforms

**Relevant examples found:**

| Platform | Model | Relevance |
|----------|-------|-----------|
| **QuantaClaw** (ours) | Per-VPS deployment | Our own OpenClaw hosting — could be used but expensive at scale |
| **SimpleClaw** | Per-instance deployment | Competitor, similar model to QuantaClaw |
| **Relevance AI** | Shared multi-tenant agents | Generic agent builder, not SEO-specific |
| **AgentGPT** | Browser-based ephemeral agents | No persistence, not suitable |
| **AutoGPT Cloud** | Shared infrastructure agents | Generic, not SEO-specialized |

**Architectural patterns observed:**
- Most agent platforms use shared compute + per-customer data isolation
- VPS-per-customer is expensive and used for enterprise/high-security only
- Multi-tenant on single infrastructure is the norm for B2B SaaS

### 1.4 OpenClaw Ecosystem

**Research findings from OpenClaw docs:**

- **Multi-agent support:** Yes — `agents.list[]` supports multiple isolated agents per Gateway
- **Channel bindings:** Yes — can route different Telegram accounts to different agents via `bindings[]`
- **Session isolation:** Yes — each agent gets separate workspace, agentDir, sessions
- **Plugin/Extension model:** Yes — for custom channel plugins if needed
- **Multi-tenant deployments:** Not explicitly documented, but architecture supports it

**No evidence of other OpenClaw-based vertical agent products** in the ecosystem docs.

### 1.5 MCP Ecosystem

Our seo-mcp (35 tools, Rust binary) appears to be **one of the most comprehensive MCP servers available**. The MCP ecosystem is nascent:

- Most MCP servers are simple wrappers (5-10 tools)
- No comparable SEO-specific MCP servers found
- Our seomcp.dev SaaS is ahead of the curve on MCP-as-a-service

**Our positioning advantage:** We have both the MCP tools AND the agent infrastructure. Competitors would need to build both.

---

## 2. Architecture Deep Dive

### 2.1 Architecture Options Overview

| Option | Description | Cost/User/Mo | Best For |
|--------|-------------|--------------|----------|
| **Option 1** | Shared OpenClaw (true multi-tenant) | $0.50-2 | High-volume, low-margin |
| **Option 2** | QuantaClaw per-customer VPS | $5-20 | Enterprise, high-security |
| **Option 3** | Hybrid (shared compute, isolated data) | $2-4 | **Recommended** — balanced |

### 2.2 Option 1: Shared OpenClaw Instance (Multi-tenant)

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│            Single OpenClaw Gateway                   │
│  ┌─────────────────────────────────────────────┐    │
│  │  agents.list[]                               │    │
│  │  ├── customer-123 (id, workspace, agentDir) │    │
│  │  ├── customer-456 (id, workspace, agentDir) │    │
│  │  └── customer-789 (id, workspace, agentDir) │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────┐  ┌───────────────────────┐    │
│  │ Telegram Binding │  │  Single seo-mcp binary │    │
│  │ (multi-account)  │  │  (per-customer config) │    │
│  └─────────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**How it works:**
- Single OpenClaw Gateway process handles all customers
- Each customer = an agent in `agents.list[]` with isolated workspace
- Multiple Telegram bots via `channels.telegram.accounts`
- Bindings route each account to correct agent
- Shared seo-mcp binary, per-customer config.toml files

**Pros:**
- Lowest infrastructure cost (~$0.50-2/customer/month)
- Single deployment to maintain
- Fast provisioning (seconds)
- Efficient resource utilization

**Cons:**
- Session isolation relies on OpenClaw's internal boundaries (not process-level)
- Single point of failure (one bug affects all customers)
- Noisy neighbor risk (one customer's cron floods shared resources)
- Google credentials storage: all in same config file structure
- Limited scaling (one process can only handle so many agents)

**Scaling limits:**
- 10 customers: Easy
- 100 customers: Manageable with careful config
- 1000 customers: Likely need multiple OpenClaw instances (horizontal scaling)

### 2.3 Option 2: QuantaClaw Per-Customer VPS

**Architecture:**
```
┌──────────────────────────────────────────────────────────┐
│                    QuantaClaw Control Plane               │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Pool Manager (pre-provisioned Hetzner VPS pool)  │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ VPS: cust-123│    │ VPS: cust-456│    │ VPS: cust-789│
│ OpenClaw     │    │ OpenClaw     │    │ OpenClaw     │
│ seo-mcp      │    │ seo-mcp      │    │ seo-mcp      │
│ Telegram bot │    │ Telegram bot │    │ Telegram bot │
└──────────────┘    └──────────────┘    └──────────────┘
```

**How it works:**
- Each customer gets dedicated Hetzner VPS (CX22: $3.79/mo, 2GB RAM)
- QuantaClaw provisioning engine assigns pre-warmed VPS from pool
- Full OpenClaw + seo-mcp installed per customer
- Complete process isolation

**Pros:**
- Full isolation (security, performance, data)
- Simple mental model (1 customer = 1 VPS)
- Customer can customize anything
- No noisy neighbor issues
- Existing QuantaClaw infra handles provisioning

**Cons:**
- **Expensive:** $5-20/customer/month (VPS + pool overhead)
- Provisioning latency (even with pool, config takes time)
- Maintenance burden (N servers to keep updated)
- Pool costs when idle (~$20-40/mo for idle pool)
- Overkill for low-usage customers

**Scaling:**
- 10 customers: $50-100/mo VPS cost (manageable)
- 100 customers: $500-1000/mo VPS cost (margin squeeze)
- 1000 customers: $5000-10000/mo VPS cost (not viable at $29/mo price point)

### 2.4 Option 3: Hybrid (Shared Compute, Isolated Data) — **RECOMMENDED**

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                 Shared Compute Layer                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │           OpenClaw Gateway (1-3 instances)       │    │
│  │  Multi-agent via agents.list[] + bindings[]     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │           seo-mcp Backend (seomcp.dev API)       │    │
│  │  Process pool spawns binary per MCP request     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                 Isolated Data Layer                      │
│  ┌───────────────────┐  ┌───────────────────────────┐  │
│  │ Per-Customer:     │  │ Telegram Bots:             │  │
│  │ - Config files    │  │ - Option A: Multi-account  │  │
│  │ - Memory files    │  │   (shared bot, per-chat)   │  │
│  │ - Cron schedules  │  │ - Option B: Per-customer   │  │
│  │ - Session data    │  │   bot tokens               │  │
│  │ - Google creds    │  │                            │  │
│  └───────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**How it works:**
1. **Compute:** Shared OpenClaw + seo-mcp backend (seomcp.dev API)
2. **Data isolation:** Per-customer directories for config, memory, credentials
3. **Agent isolation:** Each customer = separate agent in `agents.list[]`
4. **Telegram:** Either multi-account on shared bot OR per-customer bot tokens
5. **Google creds:** Per-customer encrypted storage (seomcp.dev's existing system)
6. **Cron:** Per-agent cron jobs for scheduled audits

**Why this is the best approach:**

| Factor | Option 1 | Option 2 | **Option 3** |
|--------|----------|----------|--------------|
| Cost/user/month | $0.50-2 | $5-20 | **$2-4** |
| Isolation | Low | Full | **Good** |
| Provisioning speed | Seconds | Minutes | **Seconds** |
| Maintenance | Low | High | **Medium** |
| Scalability | Medium | Poor | **Good** |
| Google creds | Mixed | Isolated | **Isolated** |

**Scaling analysis:**
- 10 customers: 1 OpenClaw instance, trivial
- 100 customers: 1-2 OpenClaw instances, comfortable
- 1000 customers: 3-5 OpenClaw instances (horizontal scaling), manageable

---

## 3. OpenClaw Multi-Tenant Research

### 3.1 Session Isolation

**From `/docs/concepts/session.md`:**

OpenClaw provides robust session isolation:

```json5
{
  "session": {
    "dmScope": "per-channel-peer",  // Isolate per channel + sender
    "identityLinks": { ... }        // Link same person across channels
  }
}
```

**Session key format:**
- DMs: `agent:<agentId>:<channel>:dm:<peerId>`
- Groups: `agent:<agentId>:<channel>:group:<chatId>`
- Cron: `cron:<jobId>`

**Storage:**
- Per-agent: `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Transcripts: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

**Security note from docs:**
> "If your agent can receive DMs from multiple people, you should strongly consider enabling secure DM mode. Without it, all users share the same conversation context."

This confirms that with proper `dmScope: "per-channel-peer"` or per-agent configuration, we get proper isolation.

### 3.2 Multi-Agent Configuration

**From `/docs/gateway/configuration.md`:**

```json5
{
  "agents": {
    "list": [
      {
        "id": "customer-123",
        "workspace": "~/.openclaw/workspaces/customer-123",
        "agentDir": "~/.openclaw/agents/customer-123/agent",
        "model": "anthropic/claude-sonnet-4-20250514",
        "identity": {
          "name": "SEO Agent",
          "emoji": "📈"
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "customer-123",
      "match": {
        "channel": "telegram",
        "accountId": "cust-123-bot"
      }
    }
  ]
}
```

**Key capabilities:**
- Each agent gets isolated workspace and agentDir
- Can bind different Telegram accounts to different agents
- Per-agent model selection
- Per-agent tool restrictions (important for security)

### 3.3 Per-Agent Tool Restrictions

```json5
{
  "agents": {
    "list": [
      {
        "id": "customer-123",
        "tools": {
          "allow": [
            "seo_*",           // Only SEO tools
            "sessions_*",      // Session management
            "cron"             // Cron for scheduling
          ],
          "deny": [
            "exec",            // No shell access
            "browser",         // No browser automation
            "write"            // No arbitrary file writes
          ]
        }
      }
    ]
  }
}
```

This is critical for multi-tenant security — we can restrict each customer's agent to only use SEO-related tools.

### 3.4 Programmatic Instance Creation

**Finding:** No direct API for programmatic agent creation.

However, OpenClaw config is just JSON5 files. We can:
1. Generate config programmatically
2. Write to `~/.openclaw/openclaw.json`
3. Trigger Gateway restart via `openclaw gateway restart`

Or use the Gateway RPC:
- `config.patch` — merge partial config updates
- `config.apply` — replace full config and restart

**This is workable** for our provisioning needs.

### 3.5 Resource Footprint

**Per OpenClaw instance:**
- Memory: ~200-500MB base + ~50-100MB per active agent
- CPU: Idle when not processing, spikes during LLM calls
- Disk: ~100MB base + variable per agent workspace

**Per customer/agent:**
- Memory overhead: ~50MB session cache + workspace
- Disk: Config (~10KB) + sessions (~1MB) + memory files (~100KB)

**Estimate:** A single 4GB VPS can comfortably handle 30-50 customer agents.

---

## 4. Telegram Bot Architecture

### 4.1 Multi-Tenant Telegram Options

**Option A: Single Bot, Multiple Chats**

```
┌───────────────────────────────────────────┐
│         Single Telegram Bot                │
│         (@seomcp_bot)                      │
│  ┌─────────┬─────────┬─────────┐          │
│  │ Chat A  │ Chat B  │ Chat C  │          │
│  │(cust-1) │(cust-2) │(cust-3) │          │
│  └─────────┴─────────┴─────────┘          │
└───────────────────────────────────────────┘
```

**How it works:**
- Single bot token serves all customers
- Each customer DMs the same bot
- OpenClaw routes to correct agent via `peer` matching in bindings
- Session isolation via `dmScope: "per-channel-peer"`

**Pros:**
- Simple management (one bot)
- No bot token management per customer
- Easier onboarding

**Cons:**
- Less branding flexibility (everyone talks to same bot)
- Single point of failure for Telegram
- Rate limits apply to single bot (see below)

**Option B: Per-Customer Bot Tokens**

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ @cust1_bot  │  │ @cust2_bot  │  │ @cust3_bot  │
│  (Token A)  │  │  (Token B)  │  │  (Token C)  │
└─────────────┘  └─────────────┘  └─────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
               OpenClaw Gateway
               (multi-account)
```

**How it works:**
- Customer creates own bot via BotFather
- Provides token during onboarding
- OpenClaw uses `channels.telegram.accounts` for multi-bot

**Pros:**
- Customer owns their bot (branding)
- Distributed rate limits
- Better isolation

**Cons:**
- Customer needs to create bot (friction)
- Token management complexity
- More config per customer

### 4.2 Telegram Rate Limits

**From Telegram Bot FAQ:**

| Limit Type | Value | Implication |
|------------|-------|-------------|
| Single chat | 1 msg/second | Fine for our use case |
| Group | 20 msgs/minute | Fine, we rarely use groups |
| Bulk broadcast | 30 msgs/second free | Needs paid broadcasts for >30 |

**For our SEO agent:**
- Daily audit messages: ~1-3 per day per customer
- Alert messages: Occasional
- **No risk of hitting rate limits** with normal usage

Even with 1000 customers on single bot, 30 msgs/second is plenty.

### 4.3 Recommendation

**Start with Option A (single bot)** for MVP:
- Lower onboarding friction
- Simpler implementation
- Can migrate to Option B later for enterprise customers

Add Option B as upsell for customers who want custom branding.

---

## 5. Google Credentials Management

### 5.1 Credential Flow Options

**Option A: Customer Creates Service Account**

```
Customer                    Our System
   │                            │
   ├──► Creates GCP Project     │
   │    Creates Service Account │
   │    Downloads JSON key      │
   ├──────────────────────────►│
   │    Upload JSON to dashboard│
   │                            │
   │                    Encrypt + Store
   │                    (AES-256-GCM)
   │                            │
   │                    seo-mcp uses creds
```

**Pros:**
- Customer owns everything
- No shared quota
- Clear security boundary

**Cons:**
- Complex onboarding (GCP knowledge required)
- Customer may mess up permissions
- High friction

**Option B: OAuth Consent Flow (seomcp.dev existing)**

```
Customer                    Our System
   │                            │
   ├──► "Connect Google"        │
   │         button             │
   │                            │
   │◄── OAuth consent screen ───│
   │    (our GCP project)       │
   │                            │
   ├──► Authorizes GSC/GA4      │
   │         access             │
   │                            │
   │                    Store tokens
   │                    (AES-256-GCM encrypted)
   │                    Auto-refresh
```

**Pros:**
- One-click onboarding
- We handle token refresh
- Familiar UX

**Cons:**
- Shared quota on our GCP project
- Need OAuth consent screen verification
- We store customer tokens (liability)

### 5.2 Current seomcp.dev Implementation

**From `src/db/schema.ts`:**

```typescript
export const googleTokens = sqliteTable("google_tokens", {
  accessTokenEnc: text("access_token_enc").notNull(),   // AES-256-GCM
  refreshTokenEnc: text("refresh_token_enc").notNull(), // AES-256-GCM
  expiresAt: integer("expires_at").notNull(),
  scopes: text("scopes").notNull(),
  googleEmail: text("google_email"),
});
```

**seomcp.dev already handles:**
- OAuth flow (`/api/auth/google/start`, `/api/auth/google/callback`)
- Token encryption (AES-256-GCM)
- Auto-refresh on expiry
- Scope validation

**We can reuse this entire system** for the SEO Agent product.

### 5.3 Google API Quotas

**Per-project quotas (our shared GCP project):**

| API | Free Quota | Paid Quota |
|-----|-----------|------------|
| GSC Search Analytics | 25,000 queries/day | Scale as needed |
| GSC URL Inspection | 2,000 inspections/day | Limited |
| GA4 Data API | 200,000 tokens/day | Scale as needed |
| PageSpeed Insights | 400 requests/day | 25,000/day paid |

**Analysis for SEO Agent:**

Per customer daily usage estimate:
- 1 `generate_report` = ~20 API calls
- Occasional ad-hoc queries = ~10 calls
- Total: ~30 API calls/customer/day

**At 100 customers:** 3,000 calls/day — well within quotas
**At 1000 customers:** 30,000 calls/day — may need quota increase or per-customer projects

### 5.4 Recommendation

**Use OAuth flow (Option B)** for simplicity:
1. Customer clicks "Connect Google" in dashboard
2. OAuth consent screen appears
3. Customer authorizes GSC + GA4 access
4. Tokens stored encrypted
5. Agent uses tokens for API calls

For enterprise customers needing their own quotas, support service account upload (Option A) as premium feature.

---

## 6. Cost Model

### 6.1 Infrastructure Costs (Hybrid Architecture)

**Fixed costs (shared infrastructure):**

| Component | Spec | Monthly Cost |
|-----------|------|--------------|
| OpenClaw Server #1 | Hetzner CX32 (4GB RAM) | $5.99 |
| OpenClaw Server #2 (redundancy) | Hetzner CX32 | $5.99 |
| seomcp.dev API Server | Hetzner CPX11 (existing) | $4.29 |
| Database (SQLite/Turso) | Bundled | $0 |
| **Total Fixed** | | **~$16/month** |

**Variable costs per customer:**

| Component | Cost Per Customer/Month |
|-----------|------------------------|
| Storage (config, sessions, memory) | ~$0.10 |
| Network bandwidth | ~$0.20 |
| Google API overhead | $0 (within free quota) |
| **Total Variable** | **~$0.30/customer** |

**Scaling costs:**

| Customers | OpenClaw Servers | Total Infra Cost |
|-----------|-----------------|------------------|
| 10 | 1 | $16 + $3 = $19 |
| 100 | 2 | $22 + $30 = $52 |
| 1000 | 5 | $46 + $300 = $346 |

### 6.2 LLM Token Costs

**Per customer daily usage estimate:**

| Operation | Tokens (Input) | Tokens (Output) | Frequency |
|-----------|---------------|-----------------|-----------|
| Daily audit report | ~5,000 | ~2,000 | 1/day |
| Alert processing | ~1,000 | ~500 | 0.5/day avg |
| User queries | ~2,000 | ~1,000 | 2/day avg |
| Cron heartbeats | ~1,000 | ~200 | 4/day |
| **Daily Total** | **~9,000** | **~3,700** | |

**Monthly totals per customer:** ~280K input + 115K output ≈ 400K tokens/month

**Model costs (Claude Sonnet 4):**
- Input: $3/M tokens
- Output: $15/M tokens
- Monthly: (280K × $3 + 115K × $15) / 1M = **~$2.60/customer/month**

**With cheaper models (Claude Haiku or GPT-4o-mini for routine tasks):**
- Could reduce to ~$0.50-1.00/customer/month

### 6.3 Complete Cost Model

**Option 3 (Hybrid) — Recommended:**

| Scale | Infra/User/Mo | LLM/User/Mo | Total/User/Mo |
|-------|---------------|-------------|---------------|
| 10 users | $1.90 | $2.60 | **$4.50** |
| 100 users | $0.52 | $2.60 | **$3.12** |
| 1000 users | $0.35 | $2.60 | **$2.95** |

**Comparison with Option 2 (Per-VPS):**

| Scale | Infra/User/Mo | LLM/User/Mo | Total/User/Mo |
|-------|---------------|-------------|---------------|
| 10 users | $5.00 | $2.60 | **$7.60** |
| 100 users | $5.00 | $2.60 | **$7.60** |
| 1000 users | $5.00 | $2.60 | **$7.60** |

**Hybrid is 2-3x cheaper** at scale.

### 6.4 Pricing Recommendation

Based on costs and competitor pricing:

| Tier | Price | Includes | Our Cost | Margin |
|------|-------|----------|----------|--------|
| **Starter** | $29/mo | 1 site, daily audits, alerts | ~$4 | 86% |
| **Pro** | $79/mo | 5 sites, hourly audits, IndexNow | ~$12 | 85% |
| **Agency** | $199/mo | Unlimited sites, white-label | ~$30 | 85% |

**Break-even analysis:**
- 10 customers × $29 = $290/mo revenue vs ~$60 cost = **$230 profit**
- 100 customers × $29 = $2,900/mo revenue vs ~$360 cost = **$2,540 profit**
- 1000 customers × $29 = $29,000/mo revenue vs ~$3,300 cost = **$25,700 profit**

---

## 7. MVP Technical Specification

### 7.1 What Needs to Be Built

**New components:**

| Component | Description | Effort |
|-----------|-------------|--------|
| Customer Dashboard Extension | Add agent management to seomcp.dev dashboard | 2 weeks |
| Agent Provisioner | Create/configure agents programmatically | 1 week |
| Telegram Bot Manager | Multi-account setup, token management | 3 days |
| Cron Template System | Pre-configured SEO audit schedules | 3 days |
| Alert Router | Route SEO alerts to customer channels | 3 days |
| Billing Integration | Connect to Lemon Squeezy subscriptions | 2 days |

**Total new build: ~4 weeks**

### 7.2 What We Reuse

| Existing Component | Reuse Level | Notes |
|-------------------|-------------|-------|
| seo-mcp (35 tools) | 100% | Core SEO capabilities |
| seomcp.dev SaaS | 80% | Auth, API keys, Google OAuth, billing |
| OpenClaw Gateway | 100% | Agent runtime, channels, cron |
| SEO Agent Skill | 90% | Existing skill at `~/clawd/skills/seo-agent/` |
| QuantaClaw provisioner | 30% | Container/VPS logic (if needed) |

### 7.3 Database Schema Additions

```sql
-- Add to seomcp.dev schema

CREATE TABLE seo_agents (
  id TEXT PRIMARY KEY,              -- ULID
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisioning', -- provisioning | active | paused | error
  
  -- Site configuration
  sites TEXT NOT NULL,              -- JSON array of site configs
  
  -- Telegram configuration  
  telegram_chat_id TEXT,
  telegram_bot_token TEXT,          -- NULL if using shared bot
  
  -- Agent configuration
  agent_id TEXT NOT NULL,           -- OpenClaw agent ID
  audit_schedule TEXT NOT NULL DEFAULT 'daily', -- daily | hourly | weekly
  audit_hour INTEGER DEFAULT 9,     -- Hour to run daily audit (UTC)
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE seo_agent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES seo_agents(id),
  event_type TEXT NOT NULL,         -- audit_complete | alert | error | action
  severity TEXT,                    -- info | warning | error | critical
  message TEXT NOT NULL,
  data TEXT,                        -- JSON payload
  created_at INTEGER NOT NULL
);
```

### 7.4 API Endpoints

**New routes for `/api/agents/`:**

```typescript
// Agent management
POST   /api/agents                  // Create new SEO agent
GET    /api/agents                  // List user's agents
GET    /api/agents/:id              // Get agent details
PATCH  /api/agents/:id              // Update agent config
DELETE /api/agents/:id              // Delete agent

// Agent actions
POST   /api/agents/:id/start        // Start/resume agent
POST   /api/agents/:id/pause        // Pause agent
POST   /api/agents/:id/audit        // Trigger immediate audit
GET    /api/agents/:id/events       // Get agent event history
GET    /api/agents/:id/reports      // Get past audit reports

// Telegram setup
GET    /api/agents/:id/telegram/link  // Get Telegram pairing link
POST   /api/agents/:id/telegram/pair  // Complete pairing
```

### 7.5 Onboarding Flow

```
Step 1: User signs up / logs in (existing seomcp.dev)
                │
Step 2: "Create SEO Agent" button
                │
Step 3: Add site(s) — domain, GSC property, GA4 property
                │
Step 4: Connect Google (OAuth flow, existing)
                │
Step 5: Choose audit schedule (daily/hourly/weekly)
                │
Step 6: Connect Telegram
        ├── Option A: Click link → DM shared bot → auto-pair
        └── Option B: Provide own bot token (premium)
                │
Step 7: Agent starts! First audit runs immediately.
                │
Step 8: User receives welcome message on Telegram
        with audit results + instructions
```

### 7.6 Agent Daily Operations

**Cron schedule template:**

```json5
{
  "cron": [
    {
      "name": "SEO Daily Audit",
      "schedule": { "kind": "cron", "expr": "0 9 * * *", "tz": "UTC" },
      "sessionTarget": "isolated",
      "payload": {
        "kind": "agentTurn",
        "message": "Run daily SEO audit for all configured sites. Generate report, check for issues, alert if critical."
      },
      "delivery": {
        "mode": "announce",
        "channel": "telegram",
        "to": "${CUSTOMER_CHAT_ID}"
      }
    },
    {
      "name": "IndexNow Submission",
      "schedule": { "kind": "cron", "expr": "0 */6 * * *", "tz": "UTC" },
      "sessionTarget": "isolated", 
      "payload": {
        "kind": "agentTurn",
        "message": "Check for new/updated content and submit to IndexNow if found."
      },
      "delivery": { "mode": "none" }
    },
    {
      "name": "Health Check",
      "schedule": { "kind": "cron", "expr": "0 */2 * * *", "tz": "UTC" },
      "sessionTarget": "main",
      "wakeMode": "next-heartbeat",
      "payload": {
        "kind": "systemEvent",
        "text": "Quick health check — verify GSC/GA4 connectivity."
      }
    }
  ]
}
```

### 7.7 Telegram Integration Flow

```
User                    Telegram                   OpenClaw
  │                         │                         │
  ├── DM bot ──────────────►│                         │
  │   "Hello"               │                         │
  │                         ├────────────────────────►│
  │                         │  Inbound message        │
  │                         │                         │
  │                         │   Binding resolves      │
  │                         │   to customer agent     │
  │                         │                         │
  │                         │◄────────────────────────│
  │                         │  "Hi! I'm your SEO      │
  │◄────────────────────────│   Agent. Your sites:    │
  │   Reply                 │   - example.com (✅)    │
  │                         │   Next audit: 9 AM UTC" │
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **OpenClaw multi-tenant bugs** | Medium | High | Thorough testing, start small, monitor closely |
| **Google API quota exhaustion** | Low | High | Monitor usage, per-customer rate limiting, upgrade quota |
| **Telegram rate limits** | Very Low | Medium | Already well within limits, monitor |
| **Customer credential leakage** | Low | Critical | Encryption at rest, audit logging, SOC2 compliance |
| **Agent goes rogue** | Low | High | Tool restrictions, output filtering, human review alerts |
| **LLM costs spike** | Medium | Medium | Token budgets per customer, cheaper models for routine |
| **Noisy neighbor (resource hog)** | Medium | Medium | Per-agent resource limits, queue management |
| **Onboarding friction** | Medium | Medium | Polish UX, video tutorials, support |
| **Competition enters market** | Medium | Medium | First-mover advantage, build moat with features |
| **OpenClaw upstream changes** | Low | Medium | Pin versions, contribute upstream, maintain fork if needed |

---

## 9. Timeline Estimate

### 9.1 Phase 1: MVP (Weeks 1-4)

| Week | Deliverables |
|------|--------------|
| **Week 1** | - Agent provisioner (OpenClaw config generation) |
|           | - Database schema additions |
|           | - Basic API endpoints (CRUD) |
| **Week 2** | - Telegram pairing flow |
|           | - Cron template system |
|           | - Agent start/pause/delete |
| **Week 3** | - Dashboard UI (agent management) |
|           | - Event logging and display |
|           | - Billing integration |
| **Week 4** | - End-to-end testing |
|           | - Documentation |
|           | - Beta launch to 5-10 users |

### 9.2 Phase 2: Polish (Weeks 5-8)

| Week | Deliverables |
|------|--------------|
| **Week 5** | - Alert routing and customization |
|           | - Multi-site support |
| **Week 6** | - Report history and trends |
|           | - Slack/Discord channel options |
| **Week 7** | - White-label for agencies |
|           | - Custom bot tokens (premium) |
| **Week 8** | - Performance optimization |
|           | - Public launch |

### 9.3 Phase 3: Scale (Months 3-6)

- Auto-fix capabilities (PR generation)
- Competitor monitoring
- Content recommendations
- API access for enterprises
- Mobile app (optional)

---

## 10. Verdict & Recommendations

### 10.1 Final Verdict

| Aspect | Assessment |
|--------|------------|
| **Market opportunity** | ✅ Strong — no direct competition |
| **Technical feasibility** | ✅ High — reuses existing infrastructure |
| **Cost efficiency** | ✅ 85%+ gross margins at scale |
| **Time to market** | ✅ 4-6 weeks to MVP |
| **Risk level** | 🟡 Medium — multi-tenant complexity |

### 10.2 Recommendation

**GO with Hybrid Architecture (Option 3)**

**Confidence Level: 85%**

**Key reasons:**
1. Clear product-market fit — no autonomous SEO agents exist
2. Leverages all existing infrastructure (seo-mcp, seomcp.dev, OpenClaw)
3. Strong unit economics ($5-12 cost vs $29-199 price)
4. Reasonable technical complexity
5. Fast path to revenue

### 10.3 Immediate Next Steps

1. **Validate architecture** — Set up test multi-agent OpenClaw instance with 3 simulated customers
2. **Build provisioner** — Script to generate agent configs and cron jobs
3. **Telegram integration** — Test multi-account setup with pairing
4. **Dashboard prototype** — Add agent management to seomcp.dev
5. **Beta users** — Recruit 5-10 beta customers (existing seomcp.dev users?)

### 10.4 Success Metrics

| Metric | MVP Target | 6-Month Target |
|--------|-----------|----------------|
| Active agents | 10 | 100 |
| MRR | $300 | $3,000 |
| Churn rate | <10%/mo | <5%/mo |
| Audit accuracy | 90% | 95% |
| Customer NPS | 30+ | 50+ |

---

## Appendix A: Technology Stack Summary

| Layer | Technology |
|-------|------------|
| **Agent Runtime** | OpenClaw Gateway (Node.js/Bun) |
| **SEO Tools** | seo-mcp (Rust, 35 tools, 8MB binary) |
| **API** | seomcp.dev (Bun + Hono) |
| **Database** | SQLite + Drizzle ORM |
| **Auth** | Custom email/password + Google OAuth |
| **Billing** | Lemon Squeezy |
| **Hosting** | Hetzner VPS (CX32/CPX11) |
| **Channels** | Telegram (primary), Slack/Discord (later) |
| **LLM** | Claude Sonnet 4 (primary), Haiku (routine) |

---

## Appendix B: Competitive Positioning

```
                    Autonomous ◄─────────────────────► Manual
                        │
                        │    ┌──────────────────┐
                        │    │  SEO Agent (us)   │
                        │    │  • 24/7 operation │
                        │    │  • Telegram/Slack │
             Technical  │    │  • GSC/GA4 native │
                SEO     │    └──────────────────┘
                        │
                        │         ┌────────────────┐
                        │         │  SEO.AI         │
                        │         │  • Content only │
                        │         └────────────────┘
                        │
                        │    ┌────────────────┐
              Content   │    │  Frase         │
                SEO     │    │  • Content     │
                        │    │  • Semi-auto   │
                        │    └────────────────┘
                        │
                        │         ┌──────────────┐
                        │         │  Ahrefs/     │
                        │         │  Semrush     │
                        │         │  • Tools     │
                        │         │  • Manual    │
                        │         └──────────────┘
```

We occupy a unique position: **Technical SEO + Autonomous + Conversational**

---

*Document prepared by Kelp (Research Agent) for QuantaCodes Solutions*
*2026-02-14*
