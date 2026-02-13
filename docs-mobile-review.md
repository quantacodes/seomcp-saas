# Mobile Design Review: api.seomcp.dev/docs

**Date:** 2026-02-13  
**Viewport:** 390x844 (iPhone 14 Pro)  
**Reviewer:** Mobile Design Review Subagent

---

## Executive Summary

The docs page has significant contrast and readability issues on mobile, primarily:
1. **Nav links** are nearly invisible (low contrast gray on dark background)
2. **Body text** uses `text-slate-400` which is too faint on `#0C0C0F` background
3. **Font weights** too thin throughout
4. **Links within text** are amber but surrounding text is too faint to read
5. **Table headers** barely visible
6. **Tool cards** have low-contrast descriptions

---

## Issues Found

### P0 - Broken/Unusable

| Issue | Location | Current | Problem | Fix |
|-------|----------|---------|---------|-----|
| Nav links invisible | `nav .text-surface-600` | `#2A2A36` on `#0C0C0F` | Contrast ratio ~1.3:1 (WCAG requires 4.5:1) | Change to `#9CA3AF` (text-gray-400) |
| "Docs" current page indicator | Nav | Same as inactive links | Can't tell which page you're on | Add `text-white` or `text-brand-400` |

### P1 - Ugly/Hard to Read

| Issue | Location | Current | Problem | Fix |
|-------|----------|---------|---------|-----|
| Body text too faint | `.text-slate-400` | `#94A3B8` | Contrast ~4.7:1 on dark bg, but font-weight 400 makes it seem faint | Change to `text-slate-300` (#CBD5E1) |
| Secondary text unreadable | `.text-slate-500` | `#64748B` | Contrast ratio ~3.5:1 | Change to `text-slate-400` (#94A3B8) |
| Table header text invisible | `th .text-slate-400` | Light gray, tiny, uppercase | Nearly invisible on mobile | Make `text-slate-300`, bump font-weight to 500 |
| Tool card descriptions | `.text-slate-500` | `#64748B` | Can't read tool descriptions | Change to `text-slate-400` (#94A3B8) |
| Code label text | `.code-label` | `#5C5C6E` | Extremely low contrast | Change to `#8E8EA0` |
| Step numbers too pale | `bg-brand-500/20 text-brand-400` | Amber at 20% opacity | Step indicators are faint | Increase bg to 30%, text to `text-brand-300` |
| List items too faint | `li .text-slate-400` | `#94A3B8` | Bulleted lists hard to read | Change to `text-slate-300` |
| Code inline in text | `code .bg-surface-700` | Dark on dark | Inline code blends in | Add border, lighter bg `surface-600` |
| TOC links (desktop) | `.toc-link` | `#8E8EA0` | Sidebar links are faint | Change to `text-slate-400` |
| Footer links | `.text-slate-400` footer | Gray on dark | Hard to read footer nav | Change to `text-slate-300` |

### P2 - Nice to Have

| Issue | Location | Current | Problem | Fix |
|-------|----------|---------|---------|-----|
| Mobile nav cramped | `nav gap-4` | 8px gap on mobile | Links feel squished | Keep current, acceptable |
| Table overflow on mobile | Tables | Horizontal scroll | Tables require scrolling | Consider stacked layout later |
| Code blocks font size | `.code-block` | 0.7rem on mobile | Slightly small | Bump to 0.75rem |

---

## Specific CSS Fixes

### Fix 1: Navigation Links (P0)
```css
/* BEFORE */
nav a, nav span { color: #2A2A36; } /* text-surface-600 */

/* AFTER */
nav a { color: #9CA3AF !important; } /* visible gray */
nav a:hover { color: #fff !important; }
nav span.text-surface-600 { color: #E5A430 !important; } /* Current page = amber */
```

HTML change:
```html
<!-- BEFORE -->
<span class="text-surface-600">Docs</span>
<a href="/tools" class="text-surface-600 hover:text-white transition">Tools</a>

<!-- AFTER -->
<span class="text-brand-400 font-medium">Docs</span>
<a href="/tools" class="text-gray-400 hover:text-white transition">Tools</a>
```

### Fix 2: Body Text Contrast (P1)
```css
/* BEFORE */
.text-slate-400 { color: #94A3B8; }

/* AFTER - use slate-300 for primary body text */
.text-slate-300 { color: #CBD5E1; }
```

HTML changes needed in many places:
- `<p class="text-slate-400">` → `<p class="text-slate-300">`

### Fix 3: Secondary Text (P1)
```css
/* BEFORE */
.text-slate-500 { color: #64748B; } /* WAY too dark */

/* AFTER */
.text-slate-400 { color: #94A3B8; }
```

### Fix 4: Tool Card Descriptions (P1)
```html
<!-- BEFORE -->
<span class="text-slate-500 text-sm">— Full site SEO audit</span>

<!-- AFTER -->
<span class="text-slate-400 text-sm">— Full site SEO audit</span>
```

### Fix 5: Code Label (P1)
```css
/* BEFORE */
.code-label { color: #5C5C6E; }

/* AFTER */
.code-label { color: #9CA3AF; }
```

### Fix 6: Table Headers (P1)
```html
<!-- BEFORE -->
<th class="text-slate-400 text-xs uppercase">

<!-- AFTER -->  
<th class="text-slate-300 text-xs uppercase font-medium">
```

### Fix 7: Inline Code (P1)
```css
/* BEFORE */
code { background: #1E1E28; } /* surface-700 */

/* AFTER */
code { 
  background: #2A2A36; /* surface-600 - lighter */
  border: 1px solid #3A3A46;
}
```

### Fix 8: List Items (P1)
All `<li>` and `<ul>` with `text-slate-400` or `text-slate-500` → `text-slate-300`

---

## Implementation Checklist

- [ ] Nav: Change inactive links from `text-surface-600` to `text-gray-400`
- [ ] Nav: Change current page "Docs" to `text-brand-400 font-medium`
- [ ] Body: Replace all `text-slate-400` for main content → `text-slate-300`
- [ ] Body: Replace all `text-slate-500` → `text-slate-400`
- [ ] Tables: Header text to `text-slate-300 font-medium`
- [ ] Tool cards: Descriptions from `text-slate-500` → `text-slate-400`
- [ ] Code label: Update CSS `.code-label` color
- [ ] Inline code: Add border, lighten background
- [ ] Lists: All list items to `text-slate-300`
- [ ] Footer: Links to `text-slate-300`

---

## WCAG Compliance Notes

- **AA Standard** requires 4.5:1 contrast for normal text
- **AAA Standard** requires 7:1 contrast for normal text
- Current `text-slate-500` (#64748B) on `#0C0C0F`: **~3.5:1** ❌ Fails AA
- Current `text-slate-400` (#94A3B8) on `#0C0C0F`: **~4.7:1** ✅ Passes AA
- Proposed `text-slate-300` (#CBD5E1) on `#0C0C0F`: **~8.5:1** ✅ Passes AAA

---

## Design Identity Preserved

- ✅ Dark theme with amber (#E5A430) accent color
- ✅ Font: Inter for text, JetBrains Mono for code  
- ✅ Surface colors: #0C0C0F (bg), #16161D (cards), #1E1E28, #2A2A36 (borders)
- ✅ Amber accent for branding/CTAs
- ✅ No color palette changes, just better contrast choices within existing palette
