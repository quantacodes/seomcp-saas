import { sqlite } from "../db/index";
import { config } from "../config";
import type { AuthContext } from "../types";

/**
 * Get the start of the current month as a Unix timestamp (seconds).
 */
function getCurrentWindowStart(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

/**
 * Get the effective call limit for a user.
 * Unverified free users get 10 calls/month instead of 50.
 */
function getEffectiveLimit(auth: AuthContext): number {
  const planLimits = config.plans[auth.plan];
  if (!planLimits) return 0;

  // Unverified free users get reduced limits
  if (auth.plan === "free" && !auth.emailVerified) {
    return 10;
  }

  return planLimits.callsPerMonth;
}

/**
 * Atomic check-and-increment rate limit for a user.
 * Uses a SQLite transaction to prevent TOCTOU race conditions.
 * Rate limits are per-USER (not per-key) to prevent multi-key bypass.
 */
export function checkAndIncrementRateLimit(auth: AuthContext): {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
} {
  const planLimits = config.plans[auth.plan];
  if (!planLimits) {
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }

  const limit = getEffectiveLimit(auth);
  if (limit === Infinity) {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }

  const windowStart = getCurrentWindowStart();

  // Atomic transaction: read + conditional increment
  return sqlite.transaction(() => {
    // Check current state
    const row = sqlite
      .query<{ call_count: number; window_start: number }, [string]>(
        "SELECT call_count, window_start FROM rate_limits WHERE user_id = ?",
      )
      .get(auth.userId);

    if (!row || row.window_start < windowStart) {
      // New window or first time — reset/create with count=1 (this call)
      if (row) {
        sqlite.run(
          "UPDATE rate_limits SET window_start = ?, call_count = 1 WHERE user_id = ?",
          [windowStart, auth.userId],
        );
      } else {
        sqlite.run(
          "INSERT INTO rate_limits (user_id, api_key_id, window_start, call_count) VALUES (?, ?, ?, 1)",
          [auth.userId, auth.apiKeyId, windowStart],
        );
      }
      return { allowed: true, used: 1, limit, remaining: limit - 1 };
    }

    // Same window — check limit before incrementing
    if (row.call_count >= limit) {
      return {
        allowed: false,
        used: row.call_count,
        limit,
        remaining: 0,
      };
    }

    // Under limit — increment
    const newCount = row.call_count + 1;
    sqlite.run(
      "UPDATE rate_limits SET call_count = ? WHERE user_id = ?",
      [newCount, auth.userId],
    );

    return {
      allowed: true,
      used: newCount,
      limit,
      remaining: Math.max(0, limit - newCount),
    };
  })();
}

/**
 * Get current rate limit status without incrementing (for usage endpoint).
 * Accepts full AuthContext to correctly apply unverified-user limits.
 */
export function getRateLimitStatus(auth: AuthContext): {
  used: number;
  limit: number;
  remaining: number;
} {
  const planLimits = config.plans[auth.plan];
  if (!planLimits) return { used: 0, limit: 0, remaining: 0 };

  const limit = getEffectiveLimit(auth);
  if (limit === Infinity) return { used: 0, limit: Infinity, remaining: Infinity };

  const windowStart = getCurrentWindowStart();

  const row = sqlite
    .query<{ call_count: number; window_start: number }, [string]>(
      "SELECT call_count, window_start FROM rate_limits WHERE user_id = ?",
    )
    .get(auth.userId);

  if (!row || row.window_start < windowStart) {
    return { used: 0, limit, remaining: limit };
  }

  return {
    used: row.call_count,
    limit,
    remaining: Math.max(0, limit - row.call_count),
  };
}

/**
 * Get the team context for a user (if any).
 * Returns the team's plan and aggregate usage if the user is on a team.
 */
export function getTeamRateContext(userId: string): {
  isTeamMember: boolean;
  teamId?: string;
  teamPlan?: string;
  teamUsed?: number;
  teamLimit?: number;
} {
  // Check if user is in a team
  const membership = sqlite
    .query("SELECT tm.team_id, t.owner_id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = ? LIMIT 1")
    .get(userId) as { team_id: string; owner_id: string } | null;

  if (!membership) return { isTeamMember: false };

  // Get owner's plan (team plan is based on the owner's subscription)
  const owner = sqlite
    .query("SELECT plan FROM users WHERE id = ?")
    .get(membership.owner_id) as { plan: string } | null;

  if (!owner) return { isTeamMember: false };

  const planLimits = config.plans[owner.plan];
  if (!planLimits) return { isTeamMember: false };

  const limit = planLimits.callsPerMonth;

  // Get aggregate team usage
  const windowStart = getCurrentWindowStart();
  const teamMembers = sqlite
    .query("SELECT user_id FROM team_members WHERE team_id = ? AND user_id IS NOT NULL")
    .all(membership.team_id) as Array<{ user_id: string }>;

  let totalUsed = 0;
  for (const m of teamMembers) {
    const row = sqlite
      .query<{ call_count: number; window_start: number }, [string]>(
        "SELECT call_count, window_start FROM rate_limits WHERE user_id = ?",
      )
      .get(m.user_id);
    if (row && row.window_start >= windowStart) {
      totalUsed += row.call_count;
    }
  }

  return {
    isTeamMember: true,
    teamId: membership.team_id,
    teamPlan: owner.plan,
    teamUsed: totalUsed,
    teamLimit: limit === Infinity ? Infinity : limit,
  };
}
