import { db, schema } from "../db/index";
import type { AuthContext } from "../types";

/**
 * Log a usage event.
 */
export function logUsage(
  auth: AuthContext,
  toolName: string,
  status: "success" | "error" | "rate_limited",
  durationMs: number,
  requestId?: string,
): void {
  try {
    db.insert(schema.usageLogs)
      .values({
        apiKeyId: auth.apiKeyId,
        userId: auth.userId,
        toolName,
        requestId: requestId || null,
        status,
        durationMs,
        createdAt: new Date(),
      })
      .run();
  } catch (error) {
    // Don't crash on usage logging failure
    console.error("Failed to log usage:", error);
  }
}
