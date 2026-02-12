import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import type { AuthContext } from "../types";

/**
 * Get the start of the current month as a Unix timestamp.
 */
function getCurrentWindowStart(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

/**
 * Check rate limit for a given auth context.
 * Returns { allowed, used, limit } or throws if DB error.
 */
export async function checkRateLimit(auth: AuthContext): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const planLimits = config.plans[auth.plan];
  if (!planLimits) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const limit = planLimits.callsPerMonth;
  if (limit === Infinity) {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }

  const windowStart = getCurrentWindowStart();

  // Get or create rate limit record
  let record = await db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.apiKeyId, auth.apiKeyId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!record || record.windowStart < windowStart) {
    // New window — reset counter
    if (record) {
      db.update(schema.rateLimits)
        .set({ windowStart, callCount: 0 })
        .where(eq(schema.rateLimits.apiKeyId, auth.apiKeyId))
        .run();
    } else {
      db.insert(schema.rateLimits)
        .values({
          apiKeyId: auth.apiKeyId,
          userId: auth.userId,
          windowStart,
          callCount: 0,
        })
        .run();
    }
    record = { apiKeyId: auth.apiKeyId, userId: auth.userId, windowStart, callCount: 0 };
  }

  const used = record.callCount;
  const allowed = used < limit;

  return {
    allowed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Increment the rate limit counter for a key.
 */
export function incrementRateLimit(apiKeyId: string): void {
  const windowStart = getCurrentWindowStart();

  // Upsert: increment if same window, reset if new window
  const existing = db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.apiKeyId, apiKeyId))
    .limit(1)
    .all()[0];

  if (existing && existing.windowStart >= windowStart) {
    db.update(schema.rateLimits)
      .set({ callCount: existing.callCount + 1 })
      .where(eq(schema.rateLimits.apiKeyId, apiKeyId))
      .run();
  } else if (existing) {
    db.update(schema.rateLimits)
      .set({ windowStart, callCount: 1 })
      .where(eq(schema.rateLimits.apiKeyId, apiKeyId))
      .run();
  } else {
    db.insert(schema.rateLimits)
      .values({ apiKeyId, userId: "", windowStart, callCount: 1 })
      .run();
  }
}
