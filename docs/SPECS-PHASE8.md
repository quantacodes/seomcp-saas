# Phase 8: Email Verification + Onboarding Polish

## 8A: Email Verification (Magic Link)

### Overview
Add email verification to the signup flow. Users can still sign up and get an API key immediately, but unverified accounts are rate-limited to 10 calls/month (vs 50 for verified free tier). This incentivizes verification without blocking the "try it now" flow.

### Flow
1. User signs up → gets API key immediately (unverified)
2. System sends verification email with a signed token link
3. User clicks link → email verified → full plan limits unlocked
4. Unverified accounts after 7 days get a reminder on dashboard
5. Unverified accounts after 30 days can't make new API calls (existing keys still work for reads)

### Database Changes
```sql
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN verification_token TEXT;
ALTER TABLE users ADD COLUMN verification_sent_at INTEGER;
```

### Verification Token
- HMAC-SHA256(userId + email + timestamp, JWT_SECRET)
- Expires after 24 hours
- One-time use (nulled after verification)
- URL: `https://seomcp.dev/verify?token=<token>&uid=<userId>`

### Email Sending
For MVP: use Resend API (free tier: 100 emails/day, 3000/month)
- Simple HTML email with verify button
- Fallback: log verification URL to console if no RESEND_API_KEY

### New Endpoints
- `GET /verify` — Verify email from magic link
- `POST /api/auth/resend-verification` — Resend verification email (rate limited: 3/hour)

### Config Additions
```typescript
resendApiKey: process.env.RESEND_API_KEY || "",
resendFromEmail: process.env.RESEND_FROM_EMAIL || "verify@seomcp.dev",
```

### Rate Limit Adjustment
Unverified users get reduced limits:
```typescript
plans: {
  free_unverified: { callsPerMonth: 10, maxSites: 1, maxKeys: 1, maxSchedules: 0 },
  free: { callsPerMonth: 50, maxSites: 1, maxKeys: 1, maxSchedules: 0 },
  // pro, agency unchanged
}
```

### Dashboard Changes
- Show verification banner if unverified: "Verify your email to unlock 50 tool calls/month"
- Show "Resend" button
- After verification: success toast + banner disappears

## 8B: Onboarding Wizard (Post-Signup)

### Overview
After signup, instead of just showing the API key, show a 3-step onboarding:
1. ✅ Account created — here's your API key (copy button)
2. 📋 Configure your AI tool (pre-filled config for Claude/Cursor/Windsurf)
3. 🔗 Connect Google (optional) — OAuth button for GSC + GA4

### Implementation
- Modify the signup modal in landing.html to show steps
- Each step has a "Next" button
- Step 3 (Google connect) opens OAuth flow in new tab
- "Skip for now" option on step 3

## 8C: Welcome Email

After verification, send a welcome email with:
- Quick start guide (3 steps)
- Link to docs
- Link to playground
- Link to dashboard

### Email Template
Simple, dark theme matching the site. No heavy HTML — works in all clients.

## Files to Create/Modify

### New Files
- `src/auth/verification.ts` — Token generation, verification, email sending
- `src/routes/verify.ts` — Verification endpoint
- `tests/verification.test.ts` — Verification tests

### Modified Files
- `src/config.ts` — Add resend config
- `src/db/migrate.ts` — Add verification columns
- `src/db/schema.ts` — Add verification fields
- `src/routes/auth.ts` — Send verification email on signup
- `src/mcp/transport.ts` — Check verification for rate limit adjustment
- `src/dashboard/app.html` — Verification banner
- `src/landing/index.html` — Onboarding steps in signup modal
- `src/index.ts` — Register verify routes
