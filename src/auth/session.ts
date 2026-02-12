import { eq, and, gt } from "drizzle-orm";
import { db, schema } from "../db/index";
import { ulid } from "../utils/ulid";

// Sessions table operations for dashboard cookie auth.
// MCP endpoint continues to use API key Bearer auth — this is dashboard-only.

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  plan: string;
}

/**
 * Create a new session for a user. Returns the session ID (used as cookie value).
 */
export function createSession(userId: string): string {
  const sessionId = ulid();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_MAX_AGE_SECONDS;

  db.insert(schema.sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt,
      createdAt: new Date(),
    })
    .run();

  return sessionId;
}

/**
 * Validate a session ID. Returns session data if valid, null if expired/not found.
 */
export function validateSession(sessionId: string): SessionData | null {
  if (!sessionId || sessionId.length < 10) return null;

  const now = Math.floor(Date.now() / 1000);

  const row = db
    .select({
      sessionId: schema.sessions.id,
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
      email: schema.users.email,
      plan: schema.users.plan,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.sessions.id, sessionId),
        gt(schema.sessions.expiresAt, now),
      ),
    )
    .limit(1)
    .all()[0];

  if (!row) return null;

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    plan: row.plan,
  };
}

/**
 * Delete a session (logout).
 */
export function deleteSession(sessionId: string): void {
  db.delete(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .run();
}

/**
 * Clean up expired sessions (call periodically).
 */
export function cleanExpiredSessions(): number {
  const now = Math.floor(Date.now() / 1000);
  const result = db
    .delete(schema.sessions)
    .where(gt(now, schema.sessions.expiresAt))
    .run();
  return result.changes;
}

/**
 * Cookie options for Set-Cookie header.
 */
export function sessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax" as const,
    path: "/dashboard",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export const SESSION_COOKIE_NAME = "session";
export { SESSION_MAX_AGE_SECONDS };
