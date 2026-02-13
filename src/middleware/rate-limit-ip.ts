/**
 * IP-based rate limiting for sensitive endpoints (signup, login).
 * In-memory — resets on restart. Fine for MVP; use Redis for scale.
 */

/**
 * Extract client IP from request headers.
 * 
 * In production behind Fly.io proxy, use Fly-Client-IP (set by Fly's proxy,
 * not spoofable). Falls back to connection IP, never trusts X-Forwarded-For
 * from untrusted clients.
 */
export function getClientIp(c: any): string {
  // Fly.io sets this header at the proxy level — not spoofable by clients
  const flyIp = c.req.header("fly-client-ip");
  if (flyIp) return flyIp;

  // Cloudflare sets this — not spoofable
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) return cfIp;

  // In production with TRUSTED_PROXY, use rightmost (proxy-added) X-Forwarded-For
  if (process.env.TRUSTED_PROXY === "true") {
    const xff = c.req.header("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",").map((s: string) => s.trim());
      // Rightmost non-empty entry is the one added by our trusted proxy
      return parts[parts.length - 1] || "no-ip";
    }
  }

  // Hono/Bun: try to get connection IP from env
  if (c.env?.remoteAddress) return c.env.remoteAddress;

  // In development/testing, allow X-Forwarded-For for test convenience
  if (process.env.NODE_ENV !== "production") {
    const xff = c.req.header("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const realIp = c.req.header("x-real-ip");
    if (realIp) return realIp;
  }

  // Absolute fallback — rate limit will be lenient for unknowns
  return "no-ip";
}

interface IpEntry {
  count: number;
  windowStart: number;
}

const ipBuckets = new Map<string, IpEntry>();

// Clean up stale entries every 5 minutes
// Uses a fixed generous threshold (2 hours) to avoid the first-caller-wins problem
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ipBuckets) {
      if (now - entry.windowStart > CLEANUP_MAX_AGE_MS) {
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
  // Don't rate limit when IP can't be determined — avoid shared bucket DoS
  if (ip === "no-ip") {
    return { allowed: true, remaining: maxRequests, retryAfterMs: 0 };
  }

  startCleanup();

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
