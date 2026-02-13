import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { generateApiKey } from "../auth/keys";
import { ulid } from "../utils/ulid";
import { config } from "../config";
import { clerk } from "../auth/clerk";
import { Webhook } from "svix";

export const authRoutes = new Hono();

/**
 * POST /api/auth/clerk-webhook
 * 
 * Clerk webhook handler for user events.
 * Syncs users to our database when they're created/updated in Clerk.
 * 
 * Events we handle:
 * - user.created: Create user in our DB + generate API key
 * - user.updated: Update email/verification status
 * - user.deleted: Optionally deactivate user (soft delete)
 */
authRoutes.post("/api/auth/clerk-webhook", async (c) => {
  // Verify webhook signature using Svix
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: "Missing Svix headers" }, 400);
  }

  const body = await c.req.text();

  // Get webhook secret from Clerk dashboard (set as CLERK_WEBHOOK_SECRET)
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET not configured");
    return c.json({ error: "Webhook not configured" }, 500);
  }

  let payload: any;
  try {
    const wh = new Webhook(webhookSecret);
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return c.json({ error: "Invalid signature" }, 401);
  }

  const eventType = payload.type;
  const data = payload.data;

  console.log(`Clerk webhook: ${eventType}`, data.id);

  try {
    switch (eventType) {
      case "user.created":
        await handleUserCreated(data);
        break;
      case "user.updated":
        await handleUserUpdated(data);
        break;
      case "user.deleted":
        await handleUserDeleted(data);
        break;
      default:
        console.log(`Unhandled Clerk event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`Error handling ${eventType}:`, err);
    // Return 200 anyway to not retry — log the error
    return c.json({ received: true, error: String(err) });
  }

  return c.json({ received: true });
});

/**
 * Handle user.created event from Clerk.
 * Creates user in our DB if not exists.
 */
async function handleUserCreated(data: any) {
  const email = data.email_addresses?.[0]?.email_address?.toLowerCase();
  if (!email) {
    console.warn("Clerk user.created without email:", data.id);
    return;
  }

  // Check if user already exists (shouldn't happen, but be safe)
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
    .all()[0];

  if (existing) {
    console.log(`User already exists: ${email}`);
    return;
  }

  // Create user
  const userId = ulid();
  const now = new Date();
  const emailVerified = data.email_addresses?.[0]?.verification?.status === "verified";

  db.insert(schema.users)
    .values({
      id: userId,
      email,
      passwordHash: "", // No password — Clerk handles auth
      plan: "free",
      emailVerified,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Auto-create first API key
  const { hash, prefix } = generateApiKey();
  const keyId = ulid();

  db.insert(schema.apiKeys)
    .values({
      id: keyId,
      userId,
      keyHash: hash,
      keyPrefix: prefix,
      name: "Default",
      isActive: true,
      createdAt: now,
    })
    .run();

  console.log(`Created user from Clerk webhook: ${email} (${userId})`);
}

/**
 * Handle user.updated event from Clerk.
 * Updates email/verification status.
 */
async function handleUserUpdated(data: any) {
  const email = data.email_addresses?.[0]?.email_address?.toLowerCase();
  if (!email) return;

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
    .all()[0];

  if (!user) {
    // User doesn't exist in our DB yet — create them
    await handleUserCreated(data);
    return;
  }

  // Update verification status
  const emailVerified = data.email_addresses?.[0]?.verification?.status === "verified";
  
  db.update(schema.users)
    .set({
      emailVerified,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))
    .run();

  console.log(`Updated user from Clerk webhook: ${email}`);
}

/**
 * Handle user.deleted event from Clerk.
 * We don't actually delete the user — just log it.
 * API keys remain for audit trail.
 */
async function handleUserDeleted(data: any) {
  // The user has been deleted from Clerk
  // We keep them in our DB for billing/audit history
  // They just won't be able to authenticate
  console.log(`Clerk user deleted: ${data.id}`);
  // Could optionally deactivate all their API keys here
}

/**
 * GET /api/auth/me
 * 
 * Returns current user info if authenticated via Clerk.
 * Useful for the frontend to check auth status.
 */
authRoutes.get("/api/auth/me", async (c) => {
  try {
    const { isSignedIn, toAuth } = await clerk.authenticateRequest(c.req.raw, {
      authorizedParties: [
        config.baseUrl,
        "https://seomcp.dev",
        "https://api.seomcp.dev",
        "http://localhost:3456",
      ].filter(Boolean),
    });

    if (!isSignedIn) {
      return c.json({ authenticated: false });
    }

    const auth = toAuth();
    if (!auth?.userId) {
      return c.json({ authenticated: false });
    }

    const clerkUser = await clerk.users.getUser(auth.userId);
    const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();

    if (!email) {
      return c.json({ authenticated: false });
    }

    // Find our internal user
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)
      .all()[0];

    if (!user) {
      return c.json({ 
        authenticated: true, 
        needsSync: true,
        clerkUserId: auth.userId,
        email,
      });
    }

    return c.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error("Error in /api/auth/me:", err);
    return c.json({ authenticated: false, error: String(err) });
  }
});
