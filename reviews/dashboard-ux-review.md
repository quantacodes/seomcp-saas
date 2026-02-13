# Dashboard UX/Flow Review — seomcp.dev

**Reviewer:** Barnacle 🪸🔍  
**Date:** 2026-02-14  
**Files reviewed:**  
- `src/landing/dashboard.html` (1496 lines)  
- `src/landing/login.html`  
- `src/landing/signup.html`  
- `src/landing/index.html` (1663 lines)  
- `src/routes/dashboard.ts`  
- `src/routes/auth.ts`  
- `src/routes/billing.ts`  
- `src/routes/keys.ts`  
- `src/index.ts` (CORS config)  
- `src/config.ts` (plan limits)  

---

## Verdict: **REQUEST_CHANGES** 🔴

Two P0 bugs (one breaks audits, one breaks billing for Clerk users) and several important UX/security issues need fixing before this is production-ready.

---

## P0 — Critical / Broken

### P0-1: Audit list fetch missing `API_BASE` prefix

**File:** `dashboard.html:1087`  
**Impact:** Audits tab is completely broken for the production setup (seomcp.dev → api.seomcp.dev).

The audit list URL is constructed without `API_BASE`, so it fetches from the current origin (`seomcp.dev/dashboard/api/audits`) instead of the API (`api.seomcp.dev/dashboard/api/audits`). Furthermore, the fetch interceptor at line 855 only adds Authorization headers for URLs starting with `API_BASE`, so even if the relative URL resolved, it would have no auth token.

```javascript
// ❌ CURRENT (line 1087)
const url = siteFilter
  ? '/dashboard/api/audits?site_url=' + encodeURIComponent(siteFilter) + '&limit=20'
  : '/dashboard/api/audits?limit=20';
const res = await fetch(url);

// ✅ FIX
const url = API_BASE + '/dashboard/api/audits' +
  (siteFilter ? '?site_url=' + encodeURIComponent(siteFilter) + '&limit=20' : '?limit=20');
const res = await fetch(url);
```

### P0-2: Billing routes use cookie-only auth — fails for Clerk users

**File:** `src/routes/billing.ts:17-22`  
**Impact:** All billing operations (checkout, cancel, resume, portal) return 401 for Clerk-authenticated users since the dashboard SPA uses Clerk Bearer tokens, but billing.ts uses `getSession()` (cookie-only).

The dashboard route (`src/routes/dashboard.ts`) correctly uses `getSessionHybrid()` which tries Clerk first then falls back to cookie. Billing routes don't.

```typescript
// ❌ CURRENT — billing.ts getSession()
function getSession(c: any): SessionData | null {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

// ✅ FIX — import and use the hybrid approach from dashboard.ts
// Either extract getSessionHybrid to a shared module, or duplicate the pattern:
import { getClerkSession, type ClerkSessionData } from "../auth/clerk";

async function getSessionHybrid(c: any): Promise<SessionData | ClerkSessionData | null> {
  try {
    const clerkSession = await getClerkSession(c);
    if (clerkSession) return clerkSession;
  } catch (e) {}
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}
```

**Note:** This also means `getSession(c)` calls in billing.ts need to become `await getSessionHybrid(c)` and the route handlers need to be `async`.

---

## P1 — Important UX Issues

### P1-1: Free plan limit mismatch — "50" vs "100" calls

**Files:** `dashboard.html:~1206` vs `src/config.ts:46` vs `index.html` pricing section  
**Impact:** Users see conflicting info about their plan.

- `src/config.ts:46` defines free as `callsPerMonth: 100`
- `index.html` landing page says "100 tool calls per month" (correct)
- `dashboard.html` billing tab renders "Free plan (50 calls/mo)" — **wrong**

```javascript
// ❌ CURRENT (dashboard.html, renderBilling function, line ~1206)
el.innerHTML = '<p ...>You\'re on the <strong>Free</strong> plan (50 calls/mo).</p>' + ...

// ✅ FIX — Use dynamic value from dashData
el.innerHTML = '<p ...>You\'re on the <strong>Free</strong> plan (' + 
  dashData.usage.limit + ' calls/mo).</p>' + ...
```

### P1-2: No loading indicator or error handling on billing/schedule/webhook API failures

**File:** `dashboard.html` — multiple locations  
**Impact:** When schedule/webhook API calls fail, the user gets no feedback.

Affected functions:
- `toggleSchedule()` (line 1315) — no error handling, no loading state
- `runScheduleNow()` (line 1316) — no error handling  
- `deleteSchedule()` (line 1317) — no error handling
- `removeWebhook()` (line 1354) — no error handling
- `testWebhook()` (line 1360) — partial error handling

**Suggestion:** Add try/catch with user-visible error toasts:
```javascript
async function toggleSchedule(id, isActive) {
  try {
    const res = await fetch(API_BASE + '/dashboard/api/schedules/' + id + '/update', { ... });
    if (!res.ok) { const d = await res.json(); showToast('❌ ' + (d.error || 'Failed')); return; }
    loadSchedules();
  } catch { showToast('❌ Request failed'); }
}
```

### P1-3: Google disconnect is a plain GET link — CSRF vulnerable

**File:** `dashboard.html:1186`  
**Impact:** A GET link to `/api/auth/google/disconnect` can be triggered by any cross-site image/link embed — classic CSRF.

```html
<!-- ❌ CURRENT -->
<a href="/api/auth/google/disconnect" style="...">Disconnect</a>

<!-- ✅ FIX — make it a button that POSTs -->
<button onclick="disconnectGoogle()" style="...">Disconnect</button>
```
```javascript
async function disconnectGoogle() {
  if (!confirm('Disconnect Google account?')) return;
  const res = await fetch(API_BASE + '/api/auth/google/disconnect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (res.ok) loadDashboard();
}
```

### P1-4: Dashboard doesn't handle 401 mid-session gracefully

**File:** `dashboard.html` — all fetch calls except `loadDashboard()`  
**Impact:** If Clerk token expires mid-session, individual tab loads silently fail. Only `loadDashboard()` has `if (res.status === 401) redirect` logic. The audit, schedule, webhook, and key create functions just silently swallow errors or show generic "Failed".

**Suggestion:** Add a global 401 handler in the fetch interceptor:
```javascript
window.fetch = async function(url, opts) {
  // ... existing code ...
  const response = await _origFetch.call(this, url, opts);
  if (typeof url === 'string' && url.startsWith(API_BASE) && response.status === 401) {
    window.location.href = '/login';
    return response;
  }
  return response;
};
```

### P1-5: Onboarding MCP config shows truncated key prefix instead of actual key

**File:** `dashboard.html`, `renderOnboarding()` function (line ~1443)  
**Impact:** New users see `sk_live_REDACTED...` in the MCP config block instead of a usable key — confusing for the critical first-time setup.

```javascript
// CURRENT
headers: { Authorization: 'Bearer ' + firstKey.prefix + '...' }
// Shows: Bearer sk_live_REDACTED...

// The user must go to API Keys tab to copy the full key.
// Consider adding a note: "Replace with your full API key from the Keys tab"
```

**Suggestion:** Either link them to the Keys tab or add a visible callout:
```html
<div style="font-size:11px; color:var(--coral); margin-top:4px;">
  ⚠️ Replace the key above with your full API key from the <a href="#" onclick="switchTab('keys')" style="color:var(--amber);">Keys tab</a>.
</div>
```

### P1-6: Tool count inconsistency — "37 tools" vs "35 tools"

**Files:** `index.html` trust stats section  
**Impact:** The hero, pricing, and most copy says "37 tools" but the trust stats section at the bottom says:
```html
<div class="trust-stat-value">35</div>
<div class="trust-stat-label">SEO tools</div>
```
Should be `37` to match everything else.

---

## P2 — Polish / Minor

### P2-1: `rate` comparison bug in success rate color logic

**File:** `dashboard.html`, `renderStats()`, around line 959  
**Impact:** Cosmetic. The variable `rate` is a string (from `.toFixed(1)`) being compared with `>=` to numbers. JavaScript coerces it, so it works, but it's fragile.

```javascript
// ❌ CURRENT
const rate = total > 0 ? ((usage.breakdown.success / total) * 100).toFixed(1) : '—';
document.getElementById('stat-success-rate').style.color = rate >= 95 ? 'var(--sage)' : rate >= 80 ? '#FBBF24' : 'var(--coral)';

// ✅ FIX — compare as number
const rateNum = total > 0 ? (usage.breakdown.success / total) * 100 : 0;
const rateDisplay = total > 0 ? rateNum.toFixed(1) + '%' : '—';
document.getElementById('stat-success-rate').textContent = rateDisplay;
document.getElementById('stat-success-rate').style.color = rateNum >= 95 ? 'var(--sage)' : rateNum >= 80 ? '#FBBF24' : 'var(--coral)';
```

### P2-2: Commented-out nav items for Schedules and Webhooks

**File:** `dashboard.html:210-213, 220-223`  
**Impact:** Dead code. The tabs/panels for schedules and webhooks still exist and functions `loadSchedules()`, `loadWebhooks()` are called on every render. If these features aren't shipped yet, the API calls waste bandwidth.

**Suggestion:** Either:
1. Guard the `loadSchedules()` / `loadWebhooks()` calls behind a feature flag, or
2. Ship the features and uncomment the nav items

### P2-3: Key revoke button uses string concatenation with single quotes — XSS risk if keyId contains quotes

**File:** `dashboard.html:1176`  
**Impact:** Low risk (keyId is a ULID from the server, but still bad practice).

```javascript
// ❌ CURRENT
'<button onclick="openRevokeModal(\'' + k.id + '\', \'' + escHtml(k.prefix) + '\')" ...'

// ✅ FIX — use data attributes or event delegation
'<button data-key-id="' + escHtml(k.id) + '" data-key-prefix="' + escHtml(k.prefix) + '" class="revoke-btn" ...'
```
And use event delegation:
```javascript
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('revoke-btn')) {
    openRevokeModal(e.target.dataset.keyId, e.target.dataset.keyPrefix);
  }
});
```

### P2-4: Login/Signup pages duplicate 100% of the Clerk init boilerplate

**Files:** `login.html`, `signup.html`  
**Impact:** Maintenance burden. Both files have identical Clerk initialization code (100+ lines). If the Clerk publishable key or init logic changes, both must be updated.

**Suggestion:** Extract to a shared `clerk-init.js` file or at least use the same pattern as `dashboard.html`.

### P2-5: Schedule modal doesn't close on Escape for dynamically-created modals

**File:** `dashboard.html:1471` (Escape handler)  
**Impact:** The `viewAudit()` function creates a modal dynamically (line 1147) but it uses `.modal-overlay.active` class. The Escape handler at line 1471 only targets `.modal-overlay.active`, so it works for the pre-defined modals but not for the dynamic audit detail modal (which is appended to the DOM with `.active` class set directly as well as `display:flex`).

**Fix:** The dynamic modal does have a click-to-close handler and uses the `.modal-overlay` class, but the Escape handler should work since it queries all `.modal-overlay.active`. Actually — the dynamic modal uses `modal.classList.add('active')` but also sets `modal.style.display = 'flex'`. When Escape fires and removes `.active`, `display:none` from the CSS takes over. This should actually work. ✅ No fix needed — false alarm.

### P2-6: `escHtml()` in `dashboard.html` creates a DOM element on every call

**File:** `dashboard.html:1462`  
**Impact:** Minor perf. In rendering functions called with 20+ items, this creates and discards DOM elements.

```javascript
// ❌ CURRENT
function escHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

// ✅ FIX — simple regex replacement (faster, no DOM)
function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

### P2-7: No confirm/feedback for dangerous billing actions 

**File:** `dashboard.html`, `handleCancel()` — uses `confirm()` and `alert()` (browser dialogs)  
**Impact:** Works, but inconsistent with the polished modal pattern used elsewhere (key creation, revoke). Consider using custom modals for a consistent look.

### P2-8: Mobile sidebar doesn't trap focus

**File:** `dashboard.html` mobile CSS/JS  
**Impact:** Accessibility. When the mobile sidebar opens, keyboard focus can tab to elements behind the overlay. Should trap focus inside the sidebar while open.

### P2-9: No `aria-label` on interactive elements

**File:** `dashboard.html` — nav items, chart bars, buttons  
**Impact:** Screen reader users get poor context. The sidebar nav items use emoji icons with no `aria-label`. Chart bars are interactive but have no accessible name.

**Suggestion:** Add `role="button"` and `aria-label` to nav items:
```html
<div class="nav-item" data-tab="overview" onclick="switchTab('overview')" role="button" aria-label="Overview">
```

### P2-10: Landing page trust stats say "35 SEO tools" — should be "37"

**(Duplicate of P1-6 but noting it here for tracking)**

### P2-11: `font-size: 14px` body on dashboard vs `16px` on landing page

**Files:** `dashboard.html:37` vs `index.html` body style  
**Impact:** This is intentional (dashboard is denser), but the transition feels jarring when navigating from landing → dashboard. Not a bug, just noting it.

---

## Security Review Summary

| Area | Status | Notes |
|------|--------|-------|
| **CSRF** | ⚠️ Partial | POST endpoints require `Content-Type: application/json` (good). Google disconnect uses GET — **P1-3** |
| **XSS** | ✅ Good | `escHtml()` used consistently on user data in innerHTML. Minor inline handler risk — **P2-3** |
| **Auth token flow** | ⚠️ Issue | Clerk tokens not handled by billing routes — **P0-2**. No global 401 handler — **P1-4** |
| **CORS** | ✅ Good | Properly configured with `credentials: true` and explicit origin allowlist |
| **Rate limiting** | ✅ Good | Login (10/15min), signup (5/hr) rate limits in place |
| **Password hashing** | ✅ Good | bcrypt via `Bun.password.hash` |

---

## User Flow Assessment

### Signup → Login → Dashboard ✅ 
The flow works well. Clerk handles both signup and login pages. Redirect to `/dashboard` on success. Already-authenticated users get redirected away from login/signup.

### API Key Creation ✅
Smooth two-step modal (create → copy). "Copy it now — it won't be shown again" is clear. Scope restriction UI is clean.

### Audit History ⚠️
**Broken** due to P0-1 (missing API_BASE). When fixed, the flow looks good: site filter, health trend chart, click-to-view detail.

### Google Account Connection ✅ (with P1-3 fix)
Connect flow is clear. Disconnect needs CSRF fix.

### Billing ⚠️
**Broken** for Clerk users due to P0-2. Plan limit text mismatch P1-1. When fixed, the upgrade/cancel/resume flow is complete.

### Empty States ✅
Good empty states for: activity table, audit history, API keys, schedules, top tools, donut chart. The onboarding checklist for new users is excellent.

### Loading States ✅
Skeleton loading animation during initial load. Individual tab loads could use spinners but aren't terrible.

---

## What's Working Well 👏

1. **Onboarding flow** — The step-by-step checklist with MCP config is genuinely helpful for new users
2. **Single API call for overview** — One `/dashboard/api/overview` call loads everything, great for performance
3. **Consistent dark theme** — Colors, spacing, and typography are cohesive across all tabs
4. **Modal UX** — Escape to close, click-overlay to close, smooth transitions
5. **Error handling in forms** — Key creation, password change, webhook save all show inline errors
6. **Copy-to-clipboard** — Toast feedback, works via `navigator.clipboard`
7. **Mobile responsive** — Hamburger menu, sidebar overlay, responsive grids, hidden columns on mobile
8. **Security baseline** — CSRF via Content-Type, proper escaping, rate limiting, bcrypt passwords
9. **Chart tooltips** — Daily usage and health trend charts have hover tooltips
10. **Landing page** — Beautiful design, clear value prop, strong CTAs, good SEO structured data

---

## Summary of Required Changes

| ID | Priority | Summary |
|----|----------|---------|
| P0-1 | 🔴 Critical | Audit fetch missing `API_BASE` — audits tab broken |
| P0-2 | 🔴 Critical | Billing routes use cookie-only auth — billing broken for Clerk users |
| P1-1 | 🟡 Important | Free plan says "50" should be "100" calls/mo |
| P1-2 | 🟡 Important | No error handling on schedule/webhook mutations |
| P1-3 | 🟡 Important | Google disconnect uses GET — CSRF vulnerable |
| P1-4 | 🟡 Important | No global 401 handler for expired Clerk sessions |
| P1-5 | 🟡 Important | Onboarding shows truncated key — confusing for new users |
| P1-6 | 🟡 Important | Trust stats say "35 tools" — should be "37" |

Fix P0s before shipping. P1s should be addressed in the same release if possible.
