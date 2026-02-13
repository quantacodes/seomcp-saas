/**
 * IP-based rate limiting for sensitive endpoints (signup, login).
 * In-memory — resets on restart. Fine for MVP; use Redis for scale.
 */

interface IpEntry {
  count: number;
  windowStart: number;
}

const ipBuckets = new Map<string, IpEntry>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(windowMs: number): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ipBuckets) {
      if (now - entry.windowStart > windowMs * 2) {
        ipBuckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export function stopIpRateLimitCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Check if an IP is rate-limited.
 * Returns { allowed, remaining, retryAfterMs }.
 */
export function checkIpRateLimit(
  ip: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  startCleanup(windowMs);

  const now = Date.now();
  const key = ip;
  let entry = ipBuckets.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    entry = { count: 1, windowStart: now };
    ipBuckets.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}

/**
 * Reset all buckets (for testing).
 */
export function resetIpRateLimits(): void {
  ipBuckets.clear();
}
