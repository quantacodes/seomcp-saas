import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import {
  validateSession,
  SESSION_COOKIE_NAME,
  type SessionData,
} from "../auth/session";
import { getClerkSession, type ClerkSessionData } from "../auth/clerk";
import { createCheckout, cancelSubscription, resumeSubscription } from "../billing/lemonsqueezy";
import { verifyWebhookSignature, processWebhookEvent } from "../billing/webhooks";

export const billingRoutes = new Hono();

// ── Session helper (hybrid: Clerk Bearer + cookie fallback) ──
async function getSessionHybrid(c: any): Promise<SessionData | ClerkSessionData | null> {
  try {
    const clerkSession = await getClerkSession(c);
    if (clerkSession) return clerkSession;
  } catch (e) {}
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

// ── CSRF check ──
function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

/**
 * POST /api/billing/checkout — Create a checkout URL for plan upgrade
 */
billingRoutes.post("/api/billing/checkout", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const body = await c.req.json<{ plan?: string }>().catch(() => ({}));
  const plan = body.plan;

  if (plan !== "pro" && plan !== "agency") {
    return c.json({ error: "Invalid plan. Must be 'pro' or 'agency'" }, 400);
  }

  // Check if Lemon Squeezy is configured
  if (!config.lemonSqueezy.apiKey) {
    return c.json({ error: "Payment service not configured" }, 503);
  }

  // Check if user already has an active subscription for this plan
  const existingSub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, session.userId))
    .limit(1)
    .all()[0];

  if (existingSub && existingSub.status === "active" && existingSub.plan === plan) {
    return c.json({ error: "You already have this plan" }, 409);
  }

  try {
    const { url, checkoutId } = await createCheckout(plan, session.email, session.userId);
    return c.json({ url, checkoutId });
  } catch (err: any) {
    console.error("Checkout creation failed:", err.message);
    return c.json({ error: "Payment service temporarily unavailable" }, 503);
  }
});

/**
 * POST /api/billing/webhooks — Lemon Squeezy webhook receiver
 * No session auth — verified by HMAC signature only.
 */
billingRoutes.post("/api/billing/webhooks", async (c) => {
  const webhookSecret = config.lemonSqueezy.webhookSecret;
  if (!webhookSecret) {
    console.error("Webhook secret not configured — rejecting webhook");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  // Get raw body for signature verification
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Signature");

  if (!verifyWebhookSignature(rawBody, signature ?? null, webhookSecret)) {
    console.error("Webhook signature verification failed");
    return c.json({ error: "Invalid signature" }, 401);
  }

  try {
    const result = processWebhookEvent(rawBody);
    if (!result.success) {
      console.error("Webhook processing failed:", result.message);
    }
    // Always return 200 to acknowledge receipt (even for processing errors)
    // Lemon Squeezy retries on non-200, which we don't want for business logic errors
    return c.json({ received: true, message: result.message }, 200);
  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
    return c.json({ received: true, error: "Processing error" }, 200);
  }
});

/**
 * GET /api/billing/portal — Get Lemon Squeezy customer portal URL
 */
billingRoutes.get("/api/billing/portal", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const sub = db
    .select({
      customerPortalUrl: schema.subscriptions.customerPortalUrl,
    })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, session.userId))
    .limit(1)
    .all()[0];

  if (!sub || !sub.customerPortalUrl) {
    return c.json({ error: "No active subscription" }, 404);
  }

  return c.json({ url: sub.customerPortalUrl });
});

/**
 * POST /api/billing/cancel — Cancel subscription (at period end)
 */
billingRoutes.post("/api/billing/cancel", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, session.userId))
    .limit(1)
    .all()[0];

  if (!sub) {
    return c.json({ error: "No active subscription" }, 404);
  }

  if (sub.status === "cancelled" || sub.status === "expired") {
    return c.json({ error: "Subscription already cancelled" }, 409);
  }

  try {
    await cancelSubscription(sub.lsSubscriptionId);

    // Update local state immediately (webhook will confirm later)
    db.update(schema.subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.userId, session.userId))
      .run();

    return c.json({
      success: true,
      message: "Subscription will cancel at the end of the current billing period",
    });
  } catch (err: any) {
    console.error("Cancel subscription failed:", err.message);
    return c.json({ error: "Failed to cancel subscription" }, 503);
  }
});

/**
 * POST /api/billing/resume — Resume a cancelled subscription
 */
billingRoutes.post("/api/billing/resume", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, session.userId))
    .limit(1)
    .all()[0];

  if (!sub) {
    return c.json({ error: "No subscription to resume" }, 404);
  }

  if (sub.status === "expired") {
    return c.json({ error: "Subscription has expired. Please create a new subscription." }, 409);
  }

  if (!sub.cancelAtPeriodEnd) {
    return c.json({ error: "Subscription is not cancelled" }, 409);
  }

  try {
    await resumeSubscription(sub.lsSubscriptionId);

    // Update local state immediately
    db.update(schema.subscriptions)
      .set({
        cancelAtPeriodEnd: false,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.userId, session.userId))
      .run();

    return c.json({ success: true, message: "Subscription resumed" });
  } catch (err: any) {
    console.error("Resume subscription failed:", err.message);
    return c.json({ error: "Failed to resume subscription" }, 503);
  }
});
