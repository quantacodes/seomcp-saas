/**
 * Clerk authentication for dashboard.
 * 
 * This replaces the custom email/password session system.
 * MCP Bearer token auth (auth/middleware.ts) remains untouched.
 */

import { createClerkClient, type User as ClerkUser } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import { ulid } from "../utils/ulid";
import { generateApiKey } from "./keys";

// ── Clerk Client ──
const clerk = createClerkClient({
  secretKey: config.clerkSecretKey,
  publishableKey: config.clerkPublishableKey,
});

export { clerk };

// ── Types ──
export interface ClerkSessionData {
  userId: string;        // Our internal user ID (ULID)
  clerkUserId: string;   // Clerk's user ID (user_xxx)
  email: string;
  plan: string;
  emailVerified: boolean;
}

// ── Session Verification ──

/**
 * Verify Clerk session from request.
 * Checks both __session cookie and Authorization: Bearer header.
 * 
 * Returns session data if valid, null otherwise.
 */
export async function verifyClerkSession(req: Request): Promise<ClerkSessionData | null> {
  try {
    // Try to verify from multiple sources
    const { isSignedIn, toAuth } = await clerk.authenticateRequest(req, {
      // Accept sessions from our domains + frontend dev server
      authorizedParties: [
        config.baseUrl,
        "https://seomcp.dev",
        "https://www.seomcp.dev",
        "https://api.seomcp.dev",
        "http://localhost:3456",
        "http://localhost:5173",  // Vite dev server
        "http://localhost:3000",
      ].filter(Boolean),
    });

    if (!isSignedIn) {
      console.log('[Clerk Debug] Not signed in');
      return null;
    }

    const auth = toAuth();
    if (!auth?.userId) {
      return null;
    }

    // Get user details from Clerk
    const clerkUser = await clerk.users.getUser(auth.userId);
    if (!clerkUser) {
      return null;
    }

    // Map Clerk user to our internal user (create if first login)
    const internalUser = await getOrCreateUser(clerkUser);
    if (!internalUser) {
      return null;
    }

    return {
      userId: internalUser.id,
      clerkUserId: auth.userId,
      email: internalUser.email,
      plan: internalUser.plan,
      emailVerified: internalUser.emailVerified,
    };
  } catch (error) {
    console.error("Clerk session verification error:", error);
    return null;
  }
}

// ── User Sync ──

interface InternalUser {
  id: string;
  email: string;
  plan: string;
  emailVerified: boolean;
}

/**
 * Get existing user by Clerk ID or email, or create new user on first login.
 * Also ensures the user has at least one API key.
 */
async function getOrCreateUser(clerkUser: ClerkUser): Promise<InternalUser | null> {
  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) {
    console.error("Clerk user has no email:", clerkUser.id);
    return null;
  }

  // First, try to find by clerkUserId (most reliable)
  let existingUser = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, clerkUser.id))
    .limit(1)
    .all()[0];

  // Fallback: find by email (for migrated users)
  if (!existingUser) {
    existingUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)
      .all()[0];
  }

  if (existingUser) {
    // Update clerkUserId if not set (migration from email/password)
    const clerkVerified = clerkUser.primaryEmailAddress?.verification?.status === "verified";
    const needsUpdate = !existingUser.clerkUserId || (clerkVerified && !existingUser.emailVerified);
    
    if (needsUpdate) {
      db.update(schema.users)
        .set({
          clerkUserId: clerkUser.id,
          emailVerified: clerkVerified || existingUser.emailVerified,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existingUser.id))
        .run();
    }

    return {
      id: existingUser.id,
      email: existingUser.email,
      plan: existingUser.plan,
      emailVerified: clerkVerified || existingUser.emailVerified,
    };
  }

  // Create new user
  const userId = ulid();
  const now = new Date();
  const emailVerified = clerkUser.primaryEmailAddress?.verification?.status === "verified";

  db.insert(schema.users)
    .values({
      id: userId,
      email,
      passwordHash: "", // No password — Clerk handles auth
      clerkUserId: clerkUser.id,
      plan: "free",
      emailVerified,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Auto-create first API key for new user
  const { raw, hash, prefix } = generateApiKey();
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

  console.log(`Created new user from Clerk: ${email} (${userId}), API key: ${prefix}...`);

  return {
    id: userId,
    email,
    plan: "free",
    emailVerified,
  };
}

/**
 * Hono middleware helper to get Clerk session from context.
 * Use this in dashboard routes instead of getSession().
 */
export async function getClerkSession(c: { req: { raw: Request } }): Promise<ClerkSessionData | null> {
  return verifyClerkSession(c.req.raw);
}

/**
 * Get the Clerk Sign-In URL.
 * In development, redirects to Clerk's hosted UI.
 */
export function getSignInUrl(redirectUrl?: string): string {
  // Use Clerk's Account Portal for hosted sign-in
  // This works without any frontend SDK
  const baseAccountPortal = `https://${getClerkDomain()}/sign-in`;
  if (redirectUrl) {
    return `${baseAccountPortal}?redirect_url=${encodeURIComponent(redirectUrl)}`;
  }
  return baseAccountPortal;
}

/**
 * Get the Clerk Sign-Up URL.
 */
export function getSignUpUrl(redirectUrl?: string): string {
  const baseAccountPortal = `https://${getClerkDomain()}/sign-up`;
  if (redirectUrl) {
    return `${baseAccountPortal}?redirect_url=${encodeURIComponent(redirectUrl)}`;
  }
  return baseAccountPortal;
}

/**
 * Get the Clerk Sign-Out URL.
 */
export function getSignOutUrl(redirectUrl?: string): string {
  const baseAccountPortal = `https://${getClerkDomain()}/sign-out`;
  if (redirectUrl) {
    return `${baseAccountPortal}?redirect_url=${encodeURIComponent(redirectUrl)}`;
  }
  return baseAccountPortal;
}

/**
 * Get the user's Clerk profile/account URL.
 */
export function getUserProfileUrl(): string {
  return `https://${getClerkDomain()}/user`;
}

/**
 * Extract Clerk domain from publishable key.
 * Format: pk_test_REDACTED.clerk.accounts.dev or pk_live_xxx.clerk.com
 */
function getClerkDomain(): string {
  const key = config.clerkPublishableKey;
  if (!key) {
    throw new Error("CLERK_PUBLISHABLE_KEY not configured");
  }
  
  // The domain is encoded in the publishable key after pk_test_ or pk_live_
  // It's base64 encoded
  const prefix = key.startsWith("pk_test_") ? "pk_test_" : "pk_live_";
  const encoded = key.slice(prefix.length);
  
  try {
    // Remove the $ suffix if present and decode
    const cleaned = encoded.replace(/\$+$/, "");
    // Use Buffer for Node.js (atob is browser-only)
    const decoded = Buffer.from(cleaned, 'base64').toString('utf-8');
    return decoded;
  } catch {
    // Fallback: construct from key pattern
    // In practice, just use Clerk's standard domains
    if (key.startsWith("pk_test_")) {
      return "clerk.seomcp.dev"; // Will be set up in Clerk dashboard
    }
    return "clerk.seomcp.dev";
  }
}
