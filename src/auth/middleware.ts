import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { hashApiKey, isValidKeyFormat } from "./keys";
import { parseScopes } from "./scopes";
import type { AuthContext } from "../types";

// Extend Hono context with auth
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/**
 * API key auth middleware.
 * Extracts Bearer token from Authorization header, validates against DB.
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return c.json({ error: "Invalid Authorization format. Use: Bearer sk_live_..." }, 401);
  }

  const apiKey = parts[1];
  if (!isValidKeyFormat(apiKey)) {
    return c.json({ error: "Invalid API key format" }, 401);
  }

  // Look up key by hash
  const keyHash = hashApiKey(apiKey);
  const keyRecord = await db
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1)
    .then((rows) => rows[0]);

  if (!keyRecord) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  if (!keyRecord.isActive) {
    return c.json({ error: "API key has been revoked" }, 401);
  }

  // Look up user
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, keyRecord.userId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  // Update last_used_at
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, keyRecord.id))
    .run();

  // Set auth context
  c.set("auth", {
    userId: user.id,
    email: user.email,
    plan: user.plan,
    apiKeyId: keyRecord.id,
    scopes: parseScopes(keyRecord.scopes),
  });

  await next();
});
