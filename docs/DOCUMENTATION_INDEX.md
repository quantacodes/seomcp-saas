# Documentation Index — SEO MCP SaaS

Quick guide to all documentation files and when to use them.

---

## 📋 Start Here

| File | Purpose | Read When |
|------|---------|-----------|
| `README.md` | Overview, quick start, API reference | First time setup |
| `ARCHITECTURE_DECISION.md` | Why we're on Hetzner + SQLite | Understanding infra choices |
| `OPERATIONS.md` | Day-to-day server management | Running production system |

---

## 🏗 Architecture & Decisions

### `ARCHITECTURE_DECISION.md` ⭐ **IMPORTANT**
**Why we stayed on Hetzner instead of migrating to Workers**

- Current architecture diagram
- Capacity analysis (100-500 users)
- Why migration isn't worth it yet
- When to reconsider (triggers)
- Monitoring & maintenance procedures
- Security checklist

**Read this if:** You're wondering about infrastructure choices

---

### `MIGRATION_PLAN_FUTURE.md`
**Reference for future Workers + D1 migration**

- Migration triggers (500+ users, $10k/mo)
- Target architecture
- 4-week migration plan
- Database query comparisons
- Cost comparison
- Risk mitigation

**Read this if:** You're approaching scale limits

---

## 🔧 Operations

### `OPERATIONS.md` ⭐ **IMPORTANT**
**Day-to-day production management**

- Common commands (restart, logs, status)
- Database queries
- Troubleshooting guides
- Maintenance schedules
- Emergency procedures
- Health check scripts

**Read this if:** Something is broken or you need to do maintenance

---

### `DEPLOY.md`
**Initial deployment guide**

- Fly.io deployment (deprecated — we're on Hetzner now)
- Environment setup
- Secret management
- Smoke testing

**Read this if:** Setting up a new instance (update for Hetzner first)

---

### `SECURITY.md`
**Security practices**

- API key handling
- Encryption
- OAuth token storage
- Audit logging

**Read this if:** Security review or incident response

---

## 📚 Product Documentation

### `README.md`
**Main product documentation**

- What is seomcp.dev
- Architecture overview
- Quick start
- API endpoints
- MCP client config
- Pricing

**Read this if:** New to the project

---

### `DESIGN-BRIEF.md`
**Landing page design spec**

- Mood board (Resend, Dub, Trigger.dev)
- Color palette (Obsidian & Amber)
- Typography (Inter)
- Layout principles
- Component list

**Read this if:** Working on frontend/design

---

### `PLAN.md`
**Product roadmap**

- Phased development plan
- Feature prioritization
- Technical debt

**Read this if:** Planning next features

---

## 🚀 Business

### `LAUNCH.md`
**Go-to-market plan**

- X announcement thread
- Product Hunt listing
- Reddit posts
- Launch checklist

**Read this if:** Preparing for launch

---

### `COMPETITION-RESEARCH.md`
**Competitive analysis**

- Similar products
- Pricing comparison
- Feature gaps
- Positioning

**Read this if:** Marketing or pricing decisions

---

## 🔬 Technical Specs

### `SPECS.md` through `SPECS-PHASE9.md`
**Implementation specifications**

- Phase 1: Core API Gateway
- Phase 1.5: Google OAuth
- Phase 2: Proxy API
- Phase 3-9: Additional features

**Read this if:** Implementing new features

---

### `SEO-AGENT-STRATEGIC-REVIEW.md`
**Strategic analysis of SEO agent market**

- Market size
- User personas
- Revenue projections
- Go-to-market strategy

**Read this if:** Business planning

---

### `SEO-AGENT-TECHNICAL-REVIEW.md`
**Technical deep-dive on SEO agent architecture**

- Current implementation
- Technical debt
- Performance analysis
- Scaling considerations

**Read this if:** Technical architecture review

---

### `BUILD-LOG.md`
**Development history**

- What was built when
- Technical decisions
- Issues encountered
- Solutions implemented

**Read this if:** Understanding history or debugging old decisions

---

## 📖 Usage Guide

### For Developers

```
1. README.md — Understand the product
2. ARCHITECTURE_DECISION.md — Understand the infra
3. SPECS.md — Understand current implementation
4. Code in src/ — Start developing
```

### For DevOps

```
1. ARCHITECTURE_DECISION.md — Current architecture
2. OPERATIONS.md — Daily operations
3. DEPLOY.md — Deployment (adapt for Hetzner)
4. SECURITY.md — Security review
```

### For Business

```
1. README.md — Product overview
2. PLAN.md — Roadmap
3. LAUNCH.md — Go-to-market
4. COMPETITION-RESEARCH.md — Competitive landscape
```

---

## 🔄 Document Maintenance

| Document | Update When |
|----------|-------------|
| `ARCHITECTURE_DECISION.md` | Infrastructure changes, capacity reviews |
| `OPERATIONS.md` | New procedures, issues encountered |
| `MIGRATION_PLAN_FUTURE.md` | Quarterly review (or when triggers met) |
| `README.md` | New features, API changes |
| `DEPLOY.md` | Deployment process changes |

---

## 🎯 Quick Reference

**Current Stack:**
- Server: Hetzner CX21 (2CPU/2GB, ~$6/mo)
- Runtime: Bun
- Database: SQLite (WAL mode)
- Binary: Rust seo-mcp-server (per-user spawn)
- Auth: API keys (SHA-256 hashed)
- Rate limit: Per-user monthly (SQLite)

**Current Limits:**
- ~200 users comfortably
- ~40 concurrent binaries max
- ~$6/mo cost

**Migration Trigger:**
- 500+ users OR
- $10k/mo revenue OR
- Global latency complaints

---

**Last Updated:** 2026-02-15  
**Next Review:** 2026-03-15 or when triggers met
