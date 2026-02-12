import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index";
import { generateApiKey } from "../auth/keys";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { ulid } from "../utils/ulid";

export const keysRoutes = new Hono();

// All key routes require auth
keysRoutes.use("/api/keys/*", authMiddleware);
keysRoutes.use("/api/keys", authMiddleware);

/**
 * GET /api/keys — List user's API keys.
 */
keysRoutes.get("/api/keys", async (c) => {
  const auth = c.get("auth");

  const keys = db
    .select({
      id: schema.apiKeys.id,
      prefix: schema.apiKeys.keyPrefix,
      name: schema.apiKeys.name,
      isActive: schema.apiKeys.isActive,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, auth.userId))
    .all();

  return c.json({ keys });
});

/**
 * POST /api/keys — Create a new API key.
 */
keysRoutes.post("/api/keys", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));

  // Check plan limits
  const planLimits = config.plans[auth.plan];
  const existingCount = db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.userId, auth.userId),
        eq(schema.apiKeys.isActive, true),
      ),
    )
    .all().length;

  if (existingCount >= planLimits.maxKeys) {
    return c.json(
      {
        error: `Maximum ${planLimits.maxKeys} API keys for ${auth.plan} plan. Upgrade for more.`,
      },
      403,
    );
  }

  const { raw, hash, prefix } = generateApiKey();
  const keyId = ulid();

  db.insert(schema.apiKeys)
    .values({
      id: keyId,
      userId: auth.userId,
      keyHash: hash,
      keyPrefix: prefix,
      name: body.name || "Untitled",
      isActive: true,
      createdAt: new Date(),
    })
    .run();

  return c.json(
    {
      id: keyId,
      key: raw, // Only shown once
      prefix,
      name: body.name || "Untitled",
      message: "Save your API key — it won't be shown again.",
    },
    201,
  );
});

/**
 * DELETE /api/keys/:id — Revoke an API key.
 */
keysRoutes.delete("/api/keys/:id", async (c) => {
  const auth = c.get("auth");
  const keyId = c.req.param("id");

  const key = db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.id, keyId),
        eq(schema.apiKeys.userId, auth.userId),
      ),
    )
    .limit(1)
    .all()[0];

  if (!key) {
    return c.json({ error: "API key not found" }, 404);
  }

  db.update(schema.apiKeys)
    .set({ isActive: false })
    .where(eq(schema.apiKeys.id, keyId))
    .run();

  return c.json({ success: true, message: "API key revoked" });
});
