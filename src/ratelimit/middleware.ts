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
 * Uses usage_logs table as single source of truth.
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

  // Atomic transaction: check count from usage_logs
  return sqlite.transaction(() => {
    // Get current count from usage_logs (single source of truth)
    // Note: created_at is stored as Unix timestamp (seconds)
    const result = sqlite
      .query<{ call_count: number }, [string, number]>(
        `SELECT COUNT(*) as call_count 
         FROM usage_logs 
         WHERE user_id = ? 
         AND created_at >= ?`,
      )
      .get(auth.userId, windowStart);

    const currentCount = result?.call_count || 0;

    // Check limit
    if (currentCount >= limit) {
      return {
        allowed: false,
        used: currentCount,
        limit,
        remaining: 0,
      };
    }

    // Allowed — return current status (actual increment happens in logUsage after call)
    return {
      allowed: true,
      used: currentCount,
      limit,
      remaining: Math.max(0, limit - currentCount),
    };
  })();
}

/**
 * Get current rate limit status from usage_logs (single source of truth).
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
  // Query usage_logs directly for single source of truth
  // Note: created_at is stored as Unix timestamp (seconds)
  const result = sqlite
    .query<{ call_count: number }, [string, number]>(
      `SELECT COUNT(*) as call_count 
       FROM usage_logs 
       WHERE user_id = ? 
       AND created_at >= ?`,
    )
    .get(auth.userId, windowStart);

  const used = result?.call_count || 0;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
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

  // Get aggregate team usage from usage_logs (single source of truth)
  const windowStart = getCurrentWindowStart();
  const teamMembers = sqlite
    .query("SELECT user_id FROM team_members WHERE team_id = ? AND user_id IS NOT NULL")
    .all(membership.team_id) as Array<{ user_id: string }>;

  let totalUsed = 0;
  for (const m of teamMembers) {
    const result = sqlite
      .query<{ call_count: number }, [string, number]>(
        `SELECT COUNT(*) as call_count 
         FROM usage_logs 
         WHERE user_id = ? 
         AND created_at >= ?`,
      )
      .get(m.user_id, windowStart);
    totalUsed += result?.call_count || 0;
  }

  return {
    isTeamMember: true,
    teamId: membership.team_id,
    teamPlan: owner.plan,
    teamUsed: totalUsed,
    teamLimit: limit === Infinity ? Infinity : limit,
  };
}
