import { describe, it, expect, beforeAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test env BEFORE any DB module loads
const testDbPath = "./data/test-billing.db";
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = "test-jwt-billing";
process.env.TOKEN_ENCRYPTION_KEY = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test-webhook-secret-12345";
process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "123456";
process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID = "789012";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

// Dynamic imports
const { Hono } = await import("hono");
const { cors } = await import("hono/cors");
const { runMigrations } = await import("../src/db/migrate");
const { authRoutes } = await import("../src/routes/auth");
const { dashboardRoutes } = await import("../src/routes/dashboard");
const { billingRoutes } = await import("../src/routes/billing");
const { verifyWebhookSignature, processWebhookEvent } = await import("../src/billing/webhooks");
const { variantToPlan } = await import("../src/billing/lemonsqueezy");
const { createHmac } = await import("crypto");
const { eq } = await import("drizzle-orm");
const { db, schema } = await import("../src/db/index");
const { resetIpRateLimits } = await import("../src/middleware/rate-limit-ip");

runMigrations();
resetIpRateLimits();

const app = new Hono();
app.use("*", cors());
app.route("/", authRoutes);
app.route("/", dashboardRoutes);
app.route("/", billingRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helpers
async function jsonReq(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

async function req(path: string, options: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, options));
}

function withCookie(sessionId: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Cookie: `session=${sessionId}`, ...extra };
}

function makeSignature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function createTestUser(email: string, password: string): Promise<string> {
  await jsonReq("/api/auth/signup", { email, password });
  const loginRes = await jsonReq("/dashboard/login", { email, password });
  const setCookie = loginRes.headers.get("Set-Cookie");
  return setCookie?.match(/session=([^;]+)/)?.[1] || "";
}

function makeSubscriptionWebhook(eventName: string, userId: string, overrides: Record<string, any> = {}): string {
  return JSON.stringify({
    meta: {
      event_name: eventName,
      custom_data: { user_id: userId },
    },
    data: {
      type: "subscriptions",
      id: overrides.id || "sub_test_123",
      attributes: {
        store_id: 1,
        customer_id: 100,
        order_id: 200,
        variant_id: overrides.variant_id || 123456, // Pro variant
        product_name: "SEO MCP",
        variant_name: overrides.variant_name || "Pro",
        user_name: "Test User",
        user_email: overrides.user_email || "test@example.com",
        status: overrides.status || "active",
        cancelled: overrides.cancelled || false,
        pause: overrides.pause || null,
        renews_at: overrides.renews_at || "2026-03-13T00:00:00.000000Z",
        ends_at: overrides.ends_at || null,
        urls: {
          update_payment_method: "https://store.lemonsqueezy.com/sub/1/payment",
          customer_portal: "https://store.lemonsqueezy.com/billing",
        },
        ...(overrides.attributes || {}),
      },
    },
  });
}

// ── Webhook Signature Tests ──
describe("Webhook Signature Verification", () => {
  const secret = "test-webhook-secret-12345";

  it("verifies valid signature", () => {
    const body = '{"test": true}';
    const sig = makeSignature(body, secret);
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const body = '{"test": true}';
    expect(verifyWebhookSignature(body, "deadbeefcafebabe", secret)).toBe(false);
  });

  it("rejects null signature", () => {
    expect(verifyWebhookSignature('{"test": true}', null, secret)).toBe(false);
  });

  it("rejects empty secret", () => {
    const body = '{"test": true}';
    const sig = makeSignature(body, secret);
    expect(verifyWebhookSignature(body, sig, "")).toBe(false);
  });

  it("rejects tampered body", () => {
    const body = '{"test": true}';
    const sig = makeSignature(body, secret);
    expect(verifyWebhookSignature('{"test": false}', sig, secret)).toBe(false);
  });

  it("rejects garbage signature", () => {
    expect(verifyWebhookSignature('{"test": true}', "not-hex-at-all!", secret)).toBe(false);
  });
});

// ── Plan Mapping Tests ──
describe("Variant to Plan Mapping", () => {
  it("maps pro variant correctly", () => {
    expect(variantToPlan("123456")).toBe("pro");
  });

  it("maps agency variant correctly", () => {
    expect(variantToPlan("789012")).toBe("agency");
  });

  it("maps numeric variant IDs", () => {
    expect(variantToPlan(123456)).toBe("pro");
    expect(variantToPlan(789012)).toBe("agency");
  });

  it("returns null for unknown variant", () => {
    expect(variantToPlan("999999")).toBeNull();
    expect(variantToPlan("")).toBeNull();
  });
});

// ── Webhook Processing Tests ──
describe("Webhook Event Processing", () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user directly in DB for webhook testing
    const signupRes = await jsonReq("/api/auth/signup", {
      email: "webhook-test@example.com",
      password: "testpass123",
    });
    const data = await signupRes.json();
    // Find user ID
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "webhook-test@example.com"))
      .limit(1)
      .all()[0];
    testUserId = user.id;
  });

  it("processes subscription_created and updates plan", () => {
    const payload = makeSubscriptionWebhook("subscription_created", testUserId, {
      id: "sub_created_1",
      user_email: "webhook-test@example.com",
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);
    expect(result.message).toContain("pro");

    // Verify user plan was updated
    const user = db
      .select({ plan: schema.users.plan })
      .from(schema.users)
      .where(eq(schema.users.id, testUserId))
      .limit(1)
      .all()[0];
    expect(user.plan).toBe("pro");

    // Verify subscription record created
    const sub = db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, testUserId))
      .limit(1)
      .all()[0];
    expect(sub).toBeTruthy();
    expect(sub.lsSubscriptionId).toBe("sub_created_1");
    expect(sub.plan).toBe("pro");
    expect(sub.status).toBe("active");
  });

  it("is idempotent — duplicate events don't create duplicates", () => {
    const payload = makeSubscriptionWebhook("subscription_created", testUserId, {
      id: "sub_created_1",
      user_email: "webhook-test@example.com",
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);
    expect(result.message).toContain("idempotent");
  });

  it("processes subscription_updated (upgrade to agency)", () => {
    const payload = makeSubscriptionWebhook("subscription_updated", testUserId, {
      id: "sub_created_1",
      variant_id: 789012,
      variant_name: "Agency",
      user_email: "webhook-test@example.com",
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);

    // Verify plan updated to agency
    const user = db
      .select({ plan: schema.users.plan })
      .from(schema.users)
      .where(eq(schema.users.id, testUserId))
      .limit(1)
      .all()[0];
    expect(user.plan).toBe("agency");
  });

  it("processes subscription_cancelled (keeps plan active)", () => {
    const payload = makeSubscriptionWebhook("subscription_cancelled", testUserId, {
      id: "sub_created_1",
      status: "cancelled",
      cancelled: true,
      ends_at: "2026-03-13T00:00:00.000000Z",
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);
    expect(result.message).toContain("period end");

    // Plan should still be agency (grace period)
    const user = db
      .select({ plan: schema.users.plan })
      .from(schema.users)
      .where(eq(schema.users.id, testUserId))
      .limit(1)
      .all()[0];
    expect(user.plan).toBe("agency");

    // Subscription should be marked as cancelling
    const sub = db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, testUserId))
      .limit(1)
      .all()[0];
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(sub.status).toBe("cancelled");
  });

  it("processes subscription_expired (downgrades to free)", () => {
    const payload = makeSubscriptionWebhook("subscription_expired", testUserId, {
      id: "sub_created_1",
      status: "expired",
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);
    expect(result.message).toContain("free");

    // User should be back to free
    const user = db
      .select({ plan: schema.users.plan })
      .from(schema.users)
      .where(eq(schema.users.id, testUserId))
      .limit(1)
      .all()[0];
    expect(user.plan).toBe("free");
  });

  it("processes subscription_resumed", () => {
    // First re-create a subscription
    const createPayload = makeSubscriptionWebhook("subscription_created", testUserId, {
      id: "sub_resumed_1",
      user_email: "webhook-test@example.com",
    });
    processWebhookEvent(createPayload);

    const resumePayload = makeSubscriptionWebhook("subscription_resumed", testUserId, {
      id: "sub_resumed_1",
      status: "active",
    });

    const result = processWebhookEvent(resumePayload);
    expect(result.success).toBe(true);

    const sub = db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, testUserId))
      .limit(1)
      .all()[0];
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.status).toBe("active");
  });

  it("falls back to email lookup when user_id not in custom_data", () => {
    // Create a new user
    const newEmail = "email-lookup@example.com";
    db.insert(schema.users).values({
      id: "user_email_lookup",
      email: newEmail,
      passwordHash: "fake",
      plan: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();

    const payload = JSON.stringify({
      meta: { event_name: "subscription_created" },
      data: {
        type: "subscriptions",
        id: "sub_email_lookup_1",
        attributes: {
          store_id: 1,
          customer_id: 200,
          order_id: 300,
          variant_id: 123456,
          product_name: "SEO MCP",
          variant_name: "Pro",
          user_name: "Email User",
          user_email: newEmail,
          status: "active",
          cancelled: false,
          pause: null,
          renews_at: "2026-04-01T00:00:00.000000Z",
          ends_at: null,
          urls: {
            update_payment_method: "https://example.com/pay",
            customer_portal: "https://example.com/billing",
          },
        },
      },
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);

    const user = db
      .select({ plan: schema.users.plan })
      .from(schema.users)
      .where(eq(schema.users.id, "user_email_lookup"))
      .limit(1)
      .all()[0];
    expect(user.plan).toBe("pro");
  });

  it("stores unknown events without error", () => {
    const payload = JSON.stringify({
      meta: { event_name: "affiliate_activated" },
      data: {
        type: "affiliates",
        id: "aff_1",
        attributes: {
          store_id: 1, customer_id: 1, order_id: 1, variant_id: 1,
          product_name: "", variant_name: "", user_name: "", user_email: "",
          status: "", cancelled: false, pause: null, renews_at: null, ends_at: null,
          urls: { update_payment_method: "", customer_portal: "" },
        },
      },
    });

    const result = processWebhookEvent(payload);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Unknown event");
  });
});

// ── Billing API Route Tests ──
describe("Billing Routes", () => {
  let sessionId: string;
  const secret = "test-webhook-secret-12345";

  beforeAll(async () => {
    sessionId = await createTestUser("billing-api@example.com", "testpass123");
  });

  it("rejects checkout without auth", async () => {
    const res = await jsonReq("/api/billing/checkout", { plan: "pro" });
    expect(res.status).toBe(401);
  });

  it("rejects checkout with invalid plan", async () => {
    const res = await jsonReq(
      "/api/billing/checkout",
      { plan: "invalid" },
      withCookie(sessionId),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid plan");
  });

  it("rejects checkout without Content-Type (CSRF)", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "pro" }),
      }),
    );
    expect(res.status).toBe(415);
  });

  it("rejects webhook with missing signature", async () => {
    const body = '{"meta":{"event_name":"test"},"data":{"id":"1","type":"test","attributes":{}}}';
    const res = await app.fetch(
      new Request("http://localhost/api/billing/webhooks", {
        method: "POST",
        body,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects webhook with invalid signature", async () => {
    const body = '{"meta":{"event_name":"test"},"data":{"id":"1","type":"test","attributes":{}}}';
    const res = await app.fetch(
      new Request("http://localhost/api/billing/webhooks", {
        method: "POST",
        headers: { "X-Signature": "deadbeef" },
        body,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts webhook with valid signature", async () => {
    const userId = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "billing-api@example.com"))
      .limit(1)
      .all()[0].id;

    const body = makeSubscriptionWebhook("subscription_created", userId, {
      id: "sub_api_test_1",
      user_email: "billing-api@example.com",
    });

    const sig = makeSignature(body, secret);
    const res = await app.fetch(
      new Request("http://localhost/api/billing/webhooks", {
        method: "POST",
        headers: { "X-Signature": sig },
        body,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("portal returns 404 when no subscription", async () => {
    const newSession = await createTestUser("no-sub@example.com", "testpass123");
    const res = await req("/api/billing/portal", {
      headers: withCookie(newSession),
    });
    expect(res.status).toBe(404);
  });

  it("portal returns URL for subscribed user", async () => {
    const res = await req("/api/billing/portal", {
      headers: withCookie(sessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBeTruthy();
    expect(data.url).toContain("lemonsqueezy");
  });

  it("cancel rejects without auth", async () => {
    const res = await jsonReq("/api/billing/cancel", {});
    expect(res.status).toBe(401);
  });

  it("resume rejects without auth", async () => {
    const res = await jsonReq("/api/billing/resume", {});
    expect(res.status).toBe(401);
  });

  it("overview includes billing data", async () => {
    const res = await req("/dashboard/api/overview", {
      headers: withCookie(sessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.billing).toBeTruthy();
    expect(data.billing.plan).toBe("pro");
    expect(data.billing.status).toBe("active");
    expect(data.billing.portalUrl).toBeTruthy();
  });
});
