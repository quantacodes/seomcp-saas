# SEO MCP SaaS — Phase 4 Specs: Billing (Lemon Squeezy)

**Phase:** 4 — Billing Integration
**Author:** Coral 🧠🔎
**Date:** 2026-02-13

---

## Overview

Integrate Lemon Squeezy for subscription billing. Users can upgrade from free to Pro ($29/mo) or Agency ($79/mo) via checkout overlay. Webhooks handle subscription lifecycle events and automatically update the user's plan.

## Architecture Decision

**Lemon Squeezy over Stripe** — India-friendly (pays out globally), simpler integration, handles tax/compliance, checkout overlay keeps users on-site.

**Checkout flow:** User clicks "Upgrade" → API creates Lemon Squeezy checkout with pre-filled email + user_id as custom data → Checkout overlay opens → User pays → Webhook fires → Plan updated in DB.

**No Lemon Squeezy SDK** — Direct API calls. Keeps deps minimal.

---

## Environment Variables (new)

```
LEMONSQUEEZY_API_KEY=       # From LS dashboard → Settings → API
LEMONSQUEEZY_STORE_ID=      # Store ID number
LEMONSQUEEZY_WEBHOOK_SECRET= # Signing secret for webhook verification
LEMONSQUEEZY_PRO_VARIANT_ID= # Variant ID for Pro plan ($29/mo)
LEMONSQUEEZY_AGENCY_VARIANT_ID= # Variant ID for Agency plan ($79/mo)
```

---

## Database Changes

### New table: `subscriptions`

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,                    -- ULID
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  ls_subscription_id TEXT NOT NULL UNIQUE, -- Lemon Squeezy subscription ID
  ls_customer_id TEXT,                     -- Lemon Squeezy customer ID
  ls_order_id TEXT,                        -- Original order ID
  ls_variant_id TEXT NOT NULL,             -- Current variant ID
  plan TEXT NOT NULL,                      -- 'pro' | 'agency'
  status TEXT NOT NULL,                    -- 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused' | 'on_trial' | 'unpaid'
  current_period_end INTEGER,             -- Unix timestamp of next renewal
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0, -- boolean: 1 if cancelling at period end
  update_payment_url TEXT,                -- LS-provided URL
  customer_portal_url TEXT,               -- LS-provided portal URL
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ls_id ON subscriptions(ls_subscription_id);
```

### New table: `webhook_events`

```sql
CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  ls_id TEXT NOT NULL,                    -- Lemon Squeezy object ID
  payload TEXT NOT NULL,                  -- Full JSON payload (for replay/debugging)
  processed_at INTEGER NOT NULL,          -- Unix timestamp
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_ls_id ON webhook_events(ls_id);
```

---

## New Files

### `src/billing/lemonsqueezy.ts` — Lemon Squeezy API client

```typescript
// Functions:
// - createCheckout(variantId, userEmail, userId) → { url: string }
//   POST https://api.lemonsqueezy.com/v1/checkouts
//   With checkout_data.custom.user_id = userId, checkout_data.email = userEmail
//   checkout_options.embed = true (for overlay)
//
// - getSubscription(subscriptionId) → SubscriptionData
//   GET https://api.lemonsqueezy.com/v1/subscriptions/{id}
//
// - cancelSubscription(subscriptionId) → void
//   DELETE https://api.lemonsqueezy.com/v1/subscriptions/{id}
//   (cancels at period end, doesn't immediately end)
//
// - resumeSubscription(subscriptionId) → void
//   PATCH https://api.lemonsqueezy.com/v1/subscriptions/{id}
//   body: { data: { type: "subscriptions", id, attributes: { cancelled: false } } }
```

### `src/billing/webhooks.ts` — Webhook processing

```typescript
// Functions:
// - verifyWebhookSignature(rawBody, signatureHeader, secret) → boolean
//   HMAC-SHA256 of raw body, compare with X-Signature header using timingSafeEqual
//
// - processWebhookEvent(event) → void
//   Routes to handler based on event_name:
//   - subscription_created → create subscription record, update user.plan
//   - subscription_updated → update subscription status, plan, renewal date
//   - subscription_cancelled → mark cancel_at_period_end, keep plan active until expiry
//   - subscription_expired → set user.plan = 'free', deactivate subscription
//   - subscription_resumed → clear cancel_at_period_end
//   - subscription_paused → update status
//   - subscription_unpaused → update status
//   - subscription_payment_failed → update status to 'past_due'
//   - subscription_payment_success → update status to 'active'
//   - subscription_payment_recovered → update status to 'active'
//   - order_refunded → set user.plan = 'free', deactivate subscription

// IMPORTANT: Use idempotency — check if webhook event already processed by ls_id + event_name
```

### `src/routes/billing.ts` — Billing API routes

```
POST /api/billing/checkout
  Auth: Session cookie (dashboard)
  Body: { plan: 'pro' | 'agency' }
  Returns: { url: string } — Lemon Squeezy checkout URL
  Logic:
    1. Map plan → variant ID
    2. Call createCheckout(variantId, user.email, user.id)
    3. Return checkout URL

POST /api/billing/webhooks
  Auth: HMAC-SHA256 signature verification (X-Signature header)
  No session/API key auth — this is called by Lemon Squeezy servers
  Body: Raw JSON from Lemon Squeezy
  Logic:
    1. Verify signature
    2. Store event in webhook_events for audit trail
    3. Process event (update subscription + user plan)
    4. Return 200

GET /api/billing/portal
  Auth: Session cookie
  Returns: { url: string } — Lemon Squeezy customer portal URL
  Logic: Look up subscription, return customer_portal_url

POST /api/billing/cancel
  Auth: Session cookie
  Returns: { success: true }
  Logic: Call cancelSubscription(), mark cancel_at_period_end

POST /api/billing/resume
  Auth: Session cookie
  Returns: { success: true }
  Logic: Call resumeSubscription(), clear cancel_at_period_end
```

---

## Config Changes

Update `src/config.ts`:

```typescript
// Add to config object:
lemonSqueezy: {
  apiKey: process.env.LEMONSQUEEZY_API_KEY || "",
  storeId: process.env.LEMONSQUEEZY_STORE_ID || "",
  webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "",
  variantIds: {
    pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID || "",
    agency: process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || "",
  },
},
```

---

## Plan Mapping

```
Variant ID → Plan name mapping:
- LEMONSQUEEZY_PRO_VARIANT_ID → 'pro'
- LEMONSQUEEZY_AGENCY_VARIANT_ID → 'agency'
- No subscription → 'free'

When subscription created/updated:
1. Look up variant_id in webhook data
2. Map to plan name
3. Update users.plan in DB
4. Rate limiter picks up new plan limits automatically
```

---

## Dashboard Integration

### Billing Section (add to `app.html`)

Between the Google section and Account section, add a Billing section:

```
Current Plan: [FREE | PRO | AGENCY]
- If free: Show "Upgrade to Pro" and "Upgrade to Agency" buttons
- If pro: Show plan details, next renewal date, "Upgrade to Agency" link, "Cancel" button
- If agency: Show plan details, next renewal date, "Manage billing" (portal link), "Cancel" button
- If cancelled but still active: Show "Plan cancels on [date]", "Resume" button
- If past_due: Show warning "Payment failed — update payment method"
```

### Checkout Flow (JS)

```javascript
// On upgrade button click:
// 1. POST /api/billing/checkout with { plan: 'pro' | 'agency' }
// 2. Open returned URL with LemonSqueezy.Url.Open() for overlay
// 3. After purchase, webhook updates plan, dashboard refreshes
```

Add Lemon.js script to dashboard HTML:
```html
<script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
```

### Overview API Update

Add subscription data to `/dashboard/api/overview` response:

```json
{
  "billing": {
    "plan": "pro",
    "status": "active",
    "renewsAt": "2026-03-13T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "portalUrl": "https://...",
    "updatePaymentUrl": "https://..."
  }
}
```

---

## Security Requirements

1. **Webhook signature verification** — HMAC-SHA256 with timingSafeEqual. Reject if missing/invalid.
2. **Idempotency** — Store webhook event IDs, skip if already processed.
3. **Raw body parsing** — Webhook endpoint must get raw body for signature verification, not parsed JSON.
4. **No plan spoofing** — Plan changes ONLY happen via webhook handlers, never from user input.
5. **CSRF on billing endpoints** — Session cookie + JSON content-type check.

---

## Error Handling

- If Lemon Squeezy API is down → Return 503 with "Payment service temporarily unavailable"
- If webhook verification fails → Return 401, log the attempt
- If user already has active subscription → Don't create new checkout, return error
- If variant ID not configured → Return 503 with "Billing not configured"

---

## Test Plan

1. **Webhook signature verification** — valid, invalid, missing, tampered
2. **Plan mapping** — variant ID → plan name for all plans
3. **Webhook event processing** — subscription_created, updated, cancelled, expired, resumed
4. **Idempotency** — duplicate webhook events don't create duplicate records
5. **Checkout creation** — correct variant selection, email prefill, custom data
6. **Plan downgrade on expiry** — user.plan reverts to free when subscription expires
7. **Dashboard billing section** — shows correct state for free/pro/agency/cancelled/past_due
8. **Cancel/resume flow** — proper state transitions
