import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import { ulid } from "../utils/ulid";
import { encryptToken, decryptToken } from "../crypto/tokens";
import { getClerkSession, type ClerkSessionData } from "../auth/clerk";
import { getCookie } from "hono/cookie";
import { validateSession, SESSION_COOKIE_NAME, type SessionData } from "../auth/session";
import { createSign } from "crypto";

export const googleUploadRoutes = new Hono();

// ── Session middleware (hybrid: Clerk Bearer token OR cookie session) ──
async function getSessionHybrid(c: any): Promise<SessionData | ClerkSessionData | null> {
  // Try Clerk first (Bearer token from dashboard SPA)
  try {
    const clerkSession = await getClerkSession(c);
    if (clerkSession) return clerkSession;
  } catch (e) {
    // Clerk not configured or token invalid — fall through to cookie
  }

  // Fallback: cookie-based session (legacy)
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

// ── CSRF protection: require JSON content-type on mutating endpoints ──
function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

// ── Service Account JWT generation ──
function createServiceAccountJWT(serviceAccount: any): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signInput = `${headerB64}.${payloadB64}`;
  
  const sign = createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = sign.sign(serviceAccount.private_key, "base64url");
  
  return `${signInput}.${signature}`;
}

// ── Exchange JWT for access token ──
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = createServiceAccountJWT(serviceAccount);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error_description || "Token exchange failed");
  return data.access_token;
}

// ── List GSC properties ──
async function listGSCProperties(accessToken: string): Promise<string[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GSC API error: ${res.status}`);
  const data = await res.json() as any;
  return (data.siteEntry || []).map((s: any) => s.siteUrl);
}

// ── Routes ──

/**
 * POST /dashboard/api/google/upload — Upload service account JSON
 */
googleUploadRoutes.post("/dashboard/api/google/upload", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const jsonError = requireJson(c);
  if (jsonError) return jsonError;

  let body: any;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { service_account_json } = body;
  if (!service_account_json || typeof service_account_json !== "object") {
    return c.json({ error: "service_account_json is required and must be an object" }, 400);
  }

  // Validate the service account JSON
  const sa = service_account_json;
  
  if (sa.type !== "service_account") {
    return c.json({ error: "Invalid service account: type must be 'service_account'" }, 400);
  }

  const requiredFields = ["project_id", "private_key_id", "private_key", "client_email", "client_id"];
  for (const field of requiredFields) {
    if (!sa[field]) {
      return c.json({ error: `Invalid service account: missing ${field}` }, 400);
    }
  }

  if (!sa.client_email.match(/.*@.*\.iam\.gserviceaccount\.com$/)) {
    return c.json({ error: "Invalid service account: client_email must match *@*.iam.gserviceaccount.com" }, 400);
  }

  if (!sa.private_key.startsWith("-----BEGIN PRIVATE KEY-----")) {
    return c.json({ error: "Invalid service account: private_key must start with '-----BEGIN PRIVATE KEY-----'" }, 400);
  }

  if (sa.auth_uri !== "https://accounts.google.com/o/oauth2/auth") {
    return c.json({ error: "Invalid service account: auth_uri must be 'https://accounts.google.com/o/oauth2/auth'" }, 400);
  }

  if (!sa.token_uri || !sa.token_uri.includes("googleapis.com")) {
    return c.json({ error: "Invalid service account: token_uri must contain 'googleapis.com'" }, 400);
  }

  const jsonSize = JSON.stringify(sa).length;
  if (jsonSize > 10 * 1024) { // 10KB
    return c.json({ error: "Service account JSON too large (max 10KB)" }, 400);
  }

  try {
    // Encrypt the service account JSON
    const encryptedData = encryptToken(JSON.stringify(sa));

    // Upsert into googleCredentials table (replace if user already has service_account)
    const existingCred = db
      .select()
      .from(schema.googleCredentials)
      .where(
        and(
          eq(schema.googleCredentials.userId, session.userId),
          eq(schema.googleCredentials.credentialType, "service_account")
        )
      )
      .limit(1)
      .all()[0];

    const now = new Date();
    const credentialId = existingCred?.id || ulid();

    if (existingCred) {
      // Update existing
      db
        .update(schema.googleCredentials)
        .set({
          encryptedData,
          email: sa.client_email,
          status: "active",
          lastValidatedAt: null,
          errorMessage: null,
          gscProperties: null,
          updatedAt: now,
        })
        .where(eq(schema.googleCredentials.id, existingCred.id))
        .run();
    } else {
      // Insert new
      db
        .insert(schema.googleCredentials)
        .values({
          id: credentialId,
          userId: session.userId,
          credentialType: "service_account",
          encryptedData,
          email: sa.client_email,
          scopes: JSON.stringify(["https://www.googleapis.com/auth/webmasters.readonly"]),
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return c.json({ 
      success: true, 
      email: sa.client_email, 
      credential_id: credentialId 
    });
  } catch (error) {
    console.error("Error storing service account:", error);
    return c.json({ error: "Failed to store service account" }, 500);
  }
});

/**
 * GET /dashboard/api/google/credentials — Get user's credential status
 */
googleUploadRoutes.get("/dashboard/api/google/credentials", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const credentials = db
    .select({
      id: schema.googleCredentials.id,
      type: schema.googleCredentials.credentialType,
      email: schema.googleCredentials.email,
      status: schema.googleCredentials.status,
      gsc_properties: schema.googleCredentials.gscProperties,
      last_validated_at: schema.googleCredentials.lastValidatedAt,
      created_at: schema.googleCredentials.createdAt,
    })
    .from(schema.googleCredentials)
    .where(eq(schema.googleCredentials.userId, session.userId))
    .all();

  return c.json({ credentials });
});

/**
 * DELETE /dashboard/api/google/credentials/:id — Remove credential
 */
googleUploadRoutes.delete("/dashboard/api/google/credentials/:id", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const credentialId = c.req.param("id");
  if (!credentialId) {
    return c.json({ error: "Missing credential ID" }, 400);
  }

  // Verify ownership
  const credential = db
    .select()
    .from(schema.googleCredentials)
    .where(
      and(
        eq(schema.googleCredentials.id, credentialId),
        eq(schema.googleCredentials.userId, session.userId)
      )
    )
    .limit(1)
    .all()[0];

  if (!credential) {
    return c.json({ error: "Credential not found" }, 404);
  }

  // Delete the credential
  db
    .delete(schema.googleCredentials)
    .where(eq(schema.googleCredentials.id, credentialId))
    .run();

  return c.json({ success: true });
});

/**
 * POST /dashboard/api/google/credentials/:id/validate — Test credential
 */
googleUploadRoutes.post("/dashboard/api/google/credentials/:id/validate", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const credentialId = c.req.param("id");
  if (!credentialId) {
    return c.json({ error: "Missing credential ID" }, 400);
  }

  // Verify ownership
  const credential = db
    .select()
    .from(schema.googleCredentials)
    .where(
      and(
        eq(schema.googleCredentials.id, credentialId),
        eq(schema.googleCredentials.userId, session.userId)
      )
    )
    .limit(1)
    .all()[0];

  if (!credential) {
    return c.json({ error: "Credential not found" }, 404);
  }

  try {
    // Decrypt the stored JSON
    const serviceAccountJson = JSON.parse(decryptToken(credential.encryptedData));

    // Try to get access token and list GSC properties
    const accessToken = await getAccessToken(serviceAccountJson);
    const properties = await listGSCProperties(accessToken);

    // Update credential status
    const now = new Date();
    db
      .update(schema.googleCredentials)
      .set({
        status: "active",
        lastValidatedAt: now,
        gscProperties: JSON.stringify(properties),
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(schema.googleCredentials.id, credentialId))
      .run();

    return c.json({ 
      valid: true, 
      properties 
    });
  } catch (error) {
    // Update credential with error status
    const errorMessage = error instanceof Error ? error.message : "Validation failed";
    const now = new Date();
    
    db
      .update(schema.googleCredentials)
      .set({
        status: "error",
        errorMessage,
        updatedAt: now,
      })
      .where(eq(schema.googleCredentials.id, credentialId))
      .run();

    return c.json({ 
      valid: false, 
      error: errorMessage 
    });
  }
});