# DESIGN BRIEF — seomcp.dev Landing Page

> **Product:** SEO MCP Server — 35 SEO tools accessible via the Model Context Protocol for AI agents  
> **Price:** $29/month  
> **Audience:** Developers building AI agents/workflows that need SEO data  
> **Date:** 2026-02-13  
> **Status:** FINAL — Ready for implementation

---

## 1. Mood Board (Text-Based)

### The Three North Stars

#### 1. **Resend** (https://resend.com) — The Structural Blueprint
- **What to take:** The absolute clarity of their value prop. "Email for developers" — we need "SEO for AI agents." Their code-first hero that shows real integration code front-and-center. The way they break features into digestible cards with minimal copy. The testimonial integration feels earned, not forced.
- **Specifically steal:** The code snippet as hero element pattern. The feature grid with icon + title + one-liner + "Learn more" links. The clean section dividers that breathe.

#### 2. **Dub** (https://dub.co) — The Personality & Polish
- **What to take:** Their confident, opinionated copy ("Marketing isn't just about clicks. It's about outcomes."). The way they use real customer quotes from recognizable names (Guillermo Rauch, etc.) inline with features. The subtle animation on stats counters. Light mode that doesn't feel washed out — they prove you don't need dark mode to look premium.
- **Specifically steal:** The social proof threading (quotes woven between features, not dumped in a carousel). The live counter animation for credibility stats. The "Built to scale" infrastructure credibility section.

#### 3. **Trigger.dev** (https://trigger.dev) — The Developer Trust Pattern
- **What to take:** The "How it works" flow that visually walks through the product. The way they show code that developers actually recognize (TypeScript, real SDK patterns). The grid of integrations/extensions that shows breadth without overwhelm. The open-source badge as trust signal.
- **Specifically steal:** The step-by-step "How it works" section with code + visual. The extensions/tools grid pattern (we need this for our 35 tools). The "Trusted by developers at companies" logo bar.

---

## 2. Color Palette

### Direction: "Obsidian & Amber" — Precision Meets Intelligence

NOT another cyan-on-navy. NOT another purple gradient. The palette says: **sharp data, warm intelligence, grounded trust.**

```
Background (Deep):     #0C0C0F    — Near-black with blue-cold undertone (NOT pure #0a0a0a)
Background (Surface):  #16161D    — Card/elevated surface
Background (Raised):   #1E1E28   — Hover states, active elements
Border (Subtle):       #2A2A36    — Dividers, card borders
Border (Active):       #3D3D4E    — Focus rings, active borders

Text (Primary):        #EDEDF0    — Warm white, not clinical
Text (Secondary):      #8E8EA0    — Muted descriptions
Text (Tertiary):       #5C5C6E    — Captions, metadata

Primary (Amber):       #E5A430    — Warm amber gold — intelligence, precision, premium
Primary (Hover):       #F0B840    — Brighter on interaction
Primary (Muted):       #E5A43020  — Amber at 12% opacity for backgrounds

Accent (Sage):         #4ADE80    — Muted green — success states, "active" indicators, SEO health
Accent (Muted):        #4ADE8020  — Green at 12% for backgrounds

Signal (Coral):        #F87171    — Error, warning, broken SEO signals
Signal (Blue):         #60A5FA    — Links, informational highlights

Gradient (Hero):       linear-gradient(135deg, #E5A43015 0%, #4ADE8008 50%, transparent 100%)
Gradient (Card Glow):  radial-gradient(ellipse at center, #E5A43008 0%, transparent 70%)
```

### Why These Colors?
- **Amber gold** is rare in dev tools (everyone does blue/purple/cyan). It reads as: premium, data-rich, intelligent. Think Bloomberg Terminal meets modern SaaS.
- **Sage green** ties directly to SEO — green = healthy rankings, good scores, passing audits. It's functional, not decorative.
- **The warm-tinted dark background** (#0C0C0F with slight blue-cold undertone) avoids the "generic dark SaaS" feel. It's richer than pure black.

---

## 3. Typography

### Heading Font: **Inter** (Google Fonts)
- Yes, Inter. Not because it's trendy — because it's the most legible font for technical content at every size. It has proper tabular figures for data display. It's what developers already trust.
- **Alternative if Inter feels too safe:** **Geist** (Vercel's font) — slightly more distinctive geometric shapes, same readability.

### Body Font: **Inter**
- Same family. Consistency > variety for a technical product.

### Monospace (Code): **JetBrains Mono** or **Geist Mono**
- This will be used extensively for the config snippet, API examples, and tool names. It needs to look *good*.

### Size Scale (Desktop → Mobile)

```
Hero headline:     64px / 72px line-height / -0.02em tracking    → Mobile: 40px / 48px
Hero subhead:      20px / 30px line-height / 0 tracking          → Mobile: 17px / 26px
Section heading:   40px / 48px line-height / -0.02em tracking    → Mobile: 28px / 36px
Sub-heading (H3):  24px / 32px line-height / -0.01em tracking    → Mobile: 20px / 28px
Body:              16px / 26px line-height / 0 tracking          → Mobile: 16px / 26px
Small/Caption:     14px / 22px line-height / 0 tracking          → Mobile: 13px / 20px
Code (inline):     14px / 22px line-height / 0 tracking          → Mobile: 13px / 20px
Code (block):      15px / 24px line-height / 0 tracking          → Mobile: 13px / 20px
```

### Font Weight Usage
- **Hero:** 700 (Bold)
- **Section headings:** 600 (Semibold)
- **Sub-headings:** 600 (Semibold)
- **Body:** 400 (Regular)
- **Emphasis in body:** 500 (Medium) — not bold, just medium
- **Captions:** 400 (Regular)

---

## 4. Layout Principles

### Hero Section: "The Config Snippet"

The ONE thing visitors see first: **a real `mcp.json` config snippet that gives them 35 SEO tools.**

```
┌──────────────────────────────────────────────────────┐
│  [Logo]  seomcp.dev          Features  Pricing  Docs │
│                                                      │
│                                                      │
│           35 SEO tools.                              │
│           One line of config.                        │
│                                                      │
│     ┌──────────────────────────────────────┐         │
│     │  // mcp.json                         │         │
│     │  {                                   │         │
│     │    "mcpServers": {                   │         │
│     │      "seo": {                        │         │
│     │        "url": "https://seomcp.dev/   │         │
│     │              sse?key=YOUR_KEY"        │         │
│     │      }                               │         │
│     │    }                                 │         │
│     │  }                                   │         │
│     └──────────────────────────────────────┘         │
│                                                      │
│     [ Get API Key — $29/mo ]    [ View Docs → ]      │
│                                                      │
│     Works with: Claude · Cursor · Windsurf · Any MCP │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Why this works:**
- Developers don't want marketing fluff. They want to see *how it works*.
- The code snippet IS the hero image. No mockups, no abstract art.
- "35 SEO tools. One line of config." — the entire value prop in 7 words.
- The compatible-agents line immediately answers "does this work with my setup?"

### Section Rhythm & Spacing

- **Section padding:** 120px top/bottom (desktop), 80px (mobile)
- **Max content width:** 1120px (narrower than typical 1280px — feels more premium and readable)
- **Section alternation:** Full-width background → constrained content → full-width background
- **Between major sections:** 1px border in #2A2A36, not empty space. Borders are more intentional than voids.

### Presenting 35 Tools Without Overwhelm

**The Tool Grid: Category-first, expandable.**

```
┌─────────────────────────────────────────────────────┐
│  🔍 Research        📊 Analysis       🔗 Technical  │
│                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌───────────┐ │
│  │ Keyword      │   │ Page Audit   │   │ Site Crawl│ │
│  │ Research     │   │              │   │           │ │
│  │ 4 tools      │   │ 6 tools      │   │ 5 tools   │ │
│  └─────────────┘   └─────────────┘   └───────────┘ │
│                                                     │
│  📈 Ranking        🏗 Content        ⚡ Performance │
│                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌───────────┐ │
│  │ SERP         │   │ Content      │   │ Core Web  │ │
│  │ Tracking     │   │ Optimization │   │ Vitals    │ │
│  │ 5 tools      │   │ 8 tools      │   │ 7 tools   │ │
│  └─────────────┘   └─────────────┘   └───────────┘ │
└─────────────────────────────────────────────────────┘
```

Each category card shows:
- Category name + icon
- Tool count ("6 tools")
- On hover/click: expands to show all tool names with one-line descriptions
- One featured tool per category shown by default with a mini code example

**This is the Trigger.dev extensions grid pattern adapted for our use case.**

### "One Line of Config" Value Prop

Shown in three ways on the page:
1. **Hero:** The literal config snippet
2. **How It Works section:** 3-step flow (Get key → Add config → Ask your agent)  
3. **Comparison:** Before/after showing "Managing 5 different SEO API keys" vs "One MCP server"

### Mobile-First Approach

- **Navigation:** Collapsed hamburger with logo + single CTA ("Get Key") always visible
- **Hero code snippet:** Full-width with horizontal scroll, not truncated
- **Tool grid:** Single column, category accordion pattern
- **Sections:** Stack naturally, 80px spacing
- **Sticky CTA:** Fixed bottom bar on mobile with "Get API Key — $29/mo" that appears after scrolling past the hero
- **Touch targets:** Minimum 44px for all interactive elements

---

## 5. Unique Elements

### What Makes This NOT Another Dark SaaS Page

**1. The "Live Tool Pulse" — Signature Visual Element**

A subtle, always-visible element in the hero background: a grid of 35 small dots/nodes, each representing one tool. They pulse with a soft amber glow at random intervals, like a system heartbeat. When you hover one, it reveals the tool name. This is NOT a gradient blob — it's *data-driven decoration*.

Think of it as a constellation map of your SEO toolkit. Each node is positioned roughly by category (research tools top-left, technical tools bottom-right, etc.).

```css
/* Conceptual — not gradient blobs, but discrete points of light */
.tool-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #E5A430;
  animation: pulse 3s ease-in-out infinite;
  animation-delay: var(--delay); /* randomized per dot */
  opacity: 0.15;
}
.tool-pulse:hover {
  opacity: 1;
  transform: scale(2);
}
```

**2. The Protocol Flow Visualization**

A clean, animated diagram showing how MCP works:

```
┌──────────┐    MCP Protocol    ┌──────────┐    35 APIs    ┌──────────┐
│  Your AI  │ ──────────────── │  seomcp   │ ───────────── │ SEO Data │
│  Agent    │    (one config)   │  .dev     │  (abstracted) │ Sources  │
└──────────┘                    └──────────┘                └──────────┘
```

Animated: a data packet (small amber dot) travels from left → middle → fans out to multiple endpoints on the right. Shows the "one-to-many" abstraction visually.

This is NOT a generic flowchart. It's specific to our architecture and animated with purpose.

**3. The "$0.83/day" Reframe**

Pricing section doesn't lead with "$29/month." It leads with:

> **$0.83/day for 35 tools your agent can use right now.**
>
> That's less than your morning coffee. And unlike coffee, it actually makes your AI agent smarter.

Then show the comparison:
| Doing it yourself | seomcp.dev |
|---|---|
| 5+ API subscriptions | 1 subscription |
| $200+/month combined | $29/month |
| Weeks of integration work | 30 seconds |
| Maintain 5 auth flows | 1 API key |
| Rate limit juggling | We handle it |

**4. The "Ask Your Agent" Live Demo Concept**

A section that shows a simulated agent conversation:

```
You: "What keywords should I target for my new blog post about serverless databases?"

Agent: I'll research that for you using seomcp.dev tools.

📊 Running keyword_research("serverless databases")...
📈 Running serp_analysis("serverless databases")...  
🔍 Running competitor_keywords("neon.tech", "planetscale.com")...

Results:
- "serverless database" — 8,100 searches/mo, difficulty: 67
- "serverless postgres" — 3,200 searches/mo, difficulty: 45  ← Best opportunity
- "database as a service" — 5,400 searches/mo, difficulty: 72
...
```

This makes the product tangible. Developers see EXACTLY what their agent will do.

---

## 6. Anti-Patterns (What to AVOID)

### ❌ Generic gradient blobs
No abstract purple-blue orbs floating around. Every visual element should be *meaningful*. If it glows, it represents a tool. If it moves, it represents data flow.

### ❌ "Hero with laptop mockup"
No device frames. No browser chrome screenshots. The code IS the product. Show it raw.

### ❌ Too many CTAs
**Two CTAs total, repeated at most 3 times on the page:**
1. Primary: "Get API Key" (amber button)
2. Secondary: "View Docs" (text link with arrow)
That's it. No "Book a demo." No "Talk to sales." No "Join waitlist." This is a $29/month self-serve product.

### ❌ AI-generated stock illustrations
Zero illustrations. Zero stock photos. The visuals are: code snippets, data visualizations, the protocol flow diagram, and the tool grid. Everything is functional.

### ❌ Generic dark theme (#0a0a0a)
Our background is #0C0C0F with a subtle cold undertone. Cards are #16161D. There's depth and layers, not a flat void.

### ❌ "Trusted by 10,000+ developers" without proof
Don't show vanity numbers we can't back up on launch. Instead, show specific use cases: "Built for agents using Claude, Cursor, Windsurf, and any MCP-compatible client."

### ❌ Feature list without context
Never list tool names without showing what they DO. Every tool mention includes a one-line description of the output.

### ❌ The word "revolutionary" or "game-changing"
Copy should be direct and technical. "35 SEO tools via MCP" > "Revolutionary AI-powered SEO platform."

### ❌ Animated hero text typing effect
Overdone. Static, bold text that's immediately readable beats any animation that makes people wait.

### ❌ Horizontal scrolling carousels
Every piece of content is visible without interaction on desktop. Accordions only on mobile for the tool grid.

---

## 7. Component List (Priority Order)

### 1. Navigation (Sticky)
```
[Logo] seomcp.dev          Tools  Pricing  Docs  [Get API Key]
```
- Logo: Text-only, "seomcp" in semibold + ".dev" in amber
- Minimal links: Tools, Pricing, Docs
- Single CTA button (amber)
- On scroll: adds backdrop blur + subtle bottom border
- Mobile: hamburger + persistent CTA button

---

### 2. Hero Section (CRITICAL — This sells or kills the product)
```
Headline:    "35 SEO tools. One line of config."
Subhead:     "Give your AI agent real SEO superpowers. Keyword research, 
              SERP analysis, site audits, rank tracking — all through 
              the Model Context Protocol."
Visual:      The mcp.json config snippet (syntax highlighted, copyable)
CTAs:        [Get API Key — $29/mo]  [Read the Docs →]
Trust line:  "Works with Claude · Cursor · Windsurf · Any MCP client"
Background:  The tool-pulse constellation (subtle, ambient)
```

---

### 3. "How It Works" — 3-Step Flow
```
Step 1: Get your API key
  → Sign up, get key instantly. No approval process.

Step 2: Add one line of config  
  → Paste the MCP server URL into your agent's config. Done.

Step 3: Ask your agent anything about SEO
  → Your agent now has 35 tools. It picks the right one automatically.
```
- Each step has a small code/visual element
- Connected by a subtle animated line (amber → green → green)
- Total time estimate: "Under 60 seconds from signup to first query"

---

### 4. The Tool Grid (Full Toolkit Showcase)
```
Section heading: "Every SEO tool your agent needs"
Subhead:         "Organized by workflow. Your agent picks the right tool automatically."
```
- 6 category cards (Research, Analysis, Technical, Ranking, Content, Performance)
- Each shows 2-3 featured tools with descriptions
- Expandable to see all tools in category
- One "spotlight" tool per category with a mini code example showing input/output

---

### 5. Live Demo / Use Case Section
```
Section heading: "See it in action"
```
- The simulated agent conversation (from Section 5 above)
- Shows a real workflow: user asks question → agent calls tools → returns insights
- Maybe 2-3 different scenarios tabs: "Content Research" / "Technical Audit" / "Competitor Analysis"

---

### 6. The MCP Protocol Explanation
```
Section heading: "Why MCP?"
Subhead:         "The Model Context Protocol is how AI agents talk to tools. 
                  seomcp.dev gives your agent 35 SEO tools through one standard connection."
```
- The animated protocol flow diagram
- Brief explanation (3-4 sentences max)
- Link to MCP spec for the curious
- This section exists for developers who don't know MCP yet

---

### 7. Comparison Section
```
Section heading: "Stop juggling SEO APIs"
```
- Side-by-side table: DIY (multiple APIs, multiple keys, weeks of integration) vs. seomcp.dev (one key, 30 seconds, it just works)
- Not a competitor comparison. A workflow comparison.

---

### 8. Pricing Section
```
Section heading: "$0.83/day for the complete SEO toolkit"
```
- Single pricing card (NOT the three-tier cliché)
- One plan. $29/month. Everything included.
- Feature checklist: ✓ All 35 tools ✓ Unlimited requests ✓ All MCP clients ✓ API key management ✓ Rate limit handling ✓ No per-query fees
- "No credit card required to start" if applicable, or "Cancel anytime"
- The comparison table from above can live here or nearby

---

### 9. Developer Trust Section
```
Section heading: "Built for developers who ship"
```
- Logos of compatible MCP clients (Claude, Cursor, Windsurf, etc.)
- GitHub/open-source credibility if applicable
- API uptime/reliability stats (if available)
- "TypeScript SDK" / "Python SDK" / "Direct HTTP" — showing multiple integration paths

---

### 10. FAQ Section
```
Concise, 5-6 questions max:
- What is MCP?
- What tools are included?
- Is there a free tier / trial?
- What are the rate limits?
- Can I use this with [my agent framework]?
- How is this different from using SEO APIs directly?
```
- Accordion pattern
- No fluff. Direct answers.

---

### 11. Footer CTA (Final Push)
```
"Your agent is one config line away from 35 SEO tools."

[Get API Key →]
```
- Minimal footer below: Links to Docs, GitHub, Terms, Privacy
- No newsletter signup. No social media icons. Clean.

---

### 12. Footer
```
seomcp.dev                     Docs  ·  Pricing  ·  Terms  ·  Privacy
© 2026                         Built by [Your Company]
```
- Two lines. That's it. Respect the developer's scrollbar.

---

## Implementation Notes

### Tech Stack Recommendation
- **Framework:** Next.js 14+ (App Router) or Astro (for pure static performance)
- **Styling:** Tailwind CSS — matches the developer aesthetic, fast to iterate
- **Animations:** Framer Motion (keep them subtle, purposeful, reducible via `prefers-reduced-motion`)
- **Code highlighting:** Shiki (same engine as VS Code, best-in-class syntax highlighting)
- **Fonts:** Self-hosted Inter + JetBrains Mono (no Google Fonts latency)

### Performance Targets
- Lighthouse: 95+ across all metrics
- First Contentful Paint: < 1.2s
- Total page weight: < 500KB (excluding fonts)
- Zero layout shift (CLS: 0)

### SEO (Meta, obviously)
- An SEO tools product MUST have perfect on-page SEO
- Structured data: SoftwareApplication, Product, FAQ
- Open Graph + Twitter Cards with the config snippet as the social image
- Blog/docs subdirectory for content marketing (not a subdomain)

---

## Summary: The Design in One Sentence

**seomcp.dev looks like a Bloomberg Terminal had a baby with a modern developer docs site — dark, warm, data-rich, zero fluff, and the hero is a code snippet, not a marketing promise.**

---

*This brief is opinionated by design. When in doubt, choose clarity over creativity, code over copy, and showing over telling.*
