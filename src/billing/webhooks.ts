import { createHmac, timingSafeEqual } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index";
import { variantToPlan } from "./lemonsqueezy";
import { ulid } from "../utils/ulid";

/**
 * Verify Lemon Squeezy webhook signature.
 * Uses HMAC-SHA256 of the raw body, compared with X-Signature header.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  // Timing-safe comparison
  try {
    const sigBuf = Buffer.from(signatureHeader, "hex");
    const digestBuf = Buffer.from(digest, "hex");
    if (sigBuf.length !== digestBuf.length) return false;
    return timingSafeEqual(sigBuf, digestBuf);
  } catch {
    return false;
  }
}

/**
 * Try to store a webhook event atomically (idempotency gate).
 * Returns true if stored (new event), false if already exists (duplicate).
 * Uses UNIQUE(event_name, ls_id) constraint — no SELECT-then-INSERT race.
 */
function tryStoreWebhookEvent(eventName: string, lsId: string, payload: string): boolean {
  const now = new Date();
  try {
    db.insert(schema.webhookEvents)
      .values({
        eventName,
        lsId,
        payload,
        processedAt: now,
        createdAt: now,
      })
      .run();
    return true; // New event — proceed with processing
  } catch (err: any) {
    // UNIQUE constraint violation = duplicate event
    if (err.message?.includes("UNIQUE constraint failed") || err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return false;
    }
    throw err; // Re-throw unexpected errors
  }
}

/**
 * Store a webhook event for audit trail (unconditional — for events without idempotency).
 */
function storeWebhookEvent(eventName: string, lsId: string, payload: string): void {
  tryStoreWebhookEvent(eventName, lsId, payload);
}

interface WebhookPayload {
  meta: {
    event_name: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data: {
    type: string;
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      order_id: number;
      variant_id: number;
      product_name: string;
      variant_name: string;
      user_name: string;
      user_email: string;
      status: string;
      cancelled: boolean;
      pause: { mode: string; resumes_at: string | null } | null;
      renews_at: string | null;
      ends_at: string | null;
      urls: {
        update_payment_method: string;
        customer_portal: string;
      };
    };
  };
}

/**
 * Process a Lemon Squeezy webhook event.
 * Routes to the appropriate handler based on event_name.
 */
export function processWebhookEvent(rawPayload: string): {
  success: boolean;
  message: string;
} {
  const payload: WebhookPayload = JSON.parse(rawPayload);
  const eventName = payload.meta.event_name;
  const lsId = payload.data.id;
  const attrs = payload.data.attributes;

  // Idempotency: try to store event atomically — if duplicate, skip processing
  if (!tryStoreWebhookEvent(eventName, lsId, rawPayload)) {
    return { success: true, message: "Event already processed (idempotent)" };
  }

  // Event is now stored — process it

  // Get user_id from custom data
  const userId = payload.meta.custom_data?.user_id;

  switch (eventName) {
    case "subscription_created":
      return handleSubscriptionCreated(lsId, attrs, userId, rawPayload, eventName);

    case "subscription_updated":
      return handleSubscriptionUpdated(lsId, attrs, rawPayload, eventName);

    case "subscription_cancelled":
      return handleSubscriptionCancelled(lsId, attrs, rawPayload, eventName);

    case "subscription_expired":
      return handleSubscriptionExpired(lsId, attrs, rawPayload, eventName);

    case "subscription_resumed":
      return handleSubscriptionResumed(lsId, attrs, rawPayload, eventName);

    case "subscription_paused":
    case "subscription_unpaused":
      return handleSubscriptionStatusChange(lsId, attrs, rawPayload, eventName);

    case "subscription_payment_failed":
      return handlePaymentFailed(lsId, attrs, rawPayload, eventName);

    case "subscription_payment_success":
    case "subscription_payment_recovered":
      return handlePaymentSuccess(lsId, attrs, rawPayload, eventName);

    case "order_refunded":
      return handleOrderRefunded(lsId, attrs, rawPayload, eventName);

    default:
      // Store but don't process unknown events
      storeWebhookEvent(eventName, lsId, rawPayload);
      return { success: true, message: `Unknown event: ${eventName} — stored for audit` };
  }
}

function handleSubscriptionCreated(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  userId: string | undefined,
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  if (!userId) {
    // Try to find user by email
    const user = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, attrs.user_email.toLowerCase()))
      .limit(1)
      .all()[0];

    if (!user) {
      storeWebhookEvent(eventName, lsId, rawPayload);
      return { success: false, message: "No user found for subscription" };
    }
    userId = user.id;
  }

  const plan = variantToPlan(attrs.variant_id);
  if (!plan) {
    storeWebhookEvent(eventName, lsId, rawPayload);
    return { success: false, message: `Unknown variant: ${attrs.variant_id}` };
  }

  const now = new Date();
  const renewsAt = attrs.renews_at ? Math.floor(new Date(attrs.renews_at).getTime() / 1000) : null;

  // Upsert subscription
  const existing = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1)
    .all()[0];

  if (existing) {
    db.update(schema.subscriptions)
      .set({
        lsSubscriptionId: lsId,
        lsCustomerId: String(attrs.customer_id),
        lsOrderId: String(attrs.order_id),
        lsVariantId: String(attrs.variant_id),
        plan,
        status: attrs.status,
        currentPeriodEnd: renewsAt,
        cancelAtPeriodEnd: false,
        updatePaymentUrl: attrs.urls.update_payment_method,
        customerPortalUrl: attrs.urls.customer_portal,
        updatedAt: now,
      })
      .where(eq(schema.subscriptions.userId, userId))
      .run();
  } else {
    db.insert(schema.subscriptions)
      .values({
        id: ulid(),
        userId,
        lsSubscriptionId: lsId,
        lsCustomerId: String(attrs.customer_id),
        lsOrderId: String(attrs.order_id),
        lsVariantId: String(attrs.variant_id),
        plan,
        status: attrs.status,
        currentPeriodEnd: renewsAt,
        cancelAtPeriodEnd: false,
        updatePaymentUrl: attrs.urls.update_payment_method,
        customerPortalUrl: attrs.urls.customer_portal,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // Update user's plan
  db.update(schema.users)
    .set({ plan, updatedAt: now })
    .where(eq(schema.users.id, userId))
    .run();

  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: `Subscription created: ${plan}` };
}

function handleSubscriptionUpdated(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .limit(1)
    .all()[0];

  if (!sub) {
    storeWebhookEvent(eventName, lsId, rawPayload);
    return { success: false, message: `Subscription not found: ${lsId}` };
  }

  const mappedPlan = variantToPlan(attrs.variant_id);
  if (!mappedPlan) {
    console.warn(`⚠️ Unknown variant ${attrs.variant_id} in subscription_updated — keeping existing plan: ${sub.plan}`);
  }
  const plan = mappedPlan || sub.plan;
  const now = new Date();
  const renewsAt = attrs.renews_at ? Math.floor(new Date(attrs.renews_at).getTime() / 1000) : null;

  db.update(schema.subscriptions)
    .set({
      lsVariantId: String(attrs.variant_id),
      plan,
      status: attrs.status,
      currentPeriodEnd: renewsAt,
      cancelAtPeriodEnd: attrs.cancelled,
      updatePaymentUrl: attrs.urls.update_payment_method,
      customerPortalUrl: attrs.urls.customer_portal,
      updatedAt: now,
    })
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .run();

  // Update user's plan
  db.update(schema.users)
    .set({ plan, updatedAt: now })
    .where(eq(schema.users.id, sub.userId))
    .run();

  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: `Subscription updated: ${plan} (${attrs.status})` };
}

function handleSubscriptionCancelled(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .limit(1)
    .all()[0];

  if (!sub) {
    storeWebhookEvent(eventName, lsId, rawPayload);
    return { success: false, message: `Subscription not found: ${lsId}` };
  }

  const now = new Date();
  const endsAt = attrs.ends_at ? Math.floor(new Date(attrs.ends_at).getTime() / 1000) : null;

  // Mark as cancelled but keep plan active until period end
  db.update(schema.subscriptions)
    .set({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: endsAt,
      updatedAt: now,
    })
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .run();

  // Don't downgrade plan yet — user keeps access until period end

  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: "Subscription cancelled (access until period end)" };
}

function handleSubscriptionExpired(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .limit(1)
    .all()[0];

  if (!sub) {
    storeWebhookEvent(eventName, lsId, rawPayload);
    return { success: false, message: `Subscription not found: ${lsId}` };
  }

  const now = new Date();

  // Subscription is fully expired — downgrade to free
  db.update(schema.subscriptions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .run();

  db.update(schema.users)
    .set({ plan: "free", updatedAt: now })
    .where(eq(schema.users.id, sub.userId))
    .run();

  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: "Subscription expired — downgraded to free" };
}

function handleSubscriptionResumed(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .limit(1)
    .all()[0];

  if (!sub) {
    storeWebhookEvent(eventName, lsId, rawPayload);
    return { success: false, message: `Subscription not found: ${lsId}` };
  }

  const now = new Date();
  const renewsAt = attrs.renews_at ? Math.floor(new Date(attrs.renews_at).getTime() / 1000) : null;

  db.update(schema.subscriptions)
    .set({
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: renewsAt,
      updatedAt: now,
    })
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .run();

  // Restore user's plan (may have been downgraded to free after expiry)
  db.update(schema.users)
    .set({ plan: sub.plan, updatedAt: now })
    .where(eq(schema.users.id, sub.userId))
    .run();

  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: "Subscription resumed" };
}

function handleSubscriptionStatusChange(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  const sub = db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .limit(1)
    .all()[0];

  if (!sub) {
    storeWebhookEvent(eventName, lsId, rawPayload);
    return { success: false, message: `Subscription not found: ${lsId}` };
  }

  const now = new Date();

  db.update(schema.subscriptions)
    .set({
      status: attrs.status,
      updatedAt: now,
    })
    .where(eq(schema.subscriptions.lsSubscriptionId, lsId))
    .run();

  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: `Subscription status: ${attrs.status}` };
}

function handlePaymentFailed(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  // Payment failed — subscription_id is in the parent subscription
  // For payment events, the data.id is the subscription_invoice ID
  // We need to find by ls_subscription_id — but payment events use invoice IDs
  // Store for now and handle via subscription_updated
  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: "Payment failure recorded" };
}

function handlePaymentSuccess(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: "Payment success recorded" };
}

function handleOrderRefunded(
  lsId: string,
  attrs: WebhookPayload["data"]["attributes"],
  rawPayload: string,
  eventName: string,
): { success: boolean; message: string } {
  // On refund, find subscription by order and downgrade
  // For MVP, store the event — manual intervention may be needed
  storeWebhookEvent(eventName, lsId, rawPayload);
  return { success: true, message: "Order refund recorded — manual review may be needed" };
}
