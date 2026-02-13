import { sqlite } from "../db/index";
import { config } from "../config";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * User webhook notifications.
 * Users can register a webhook URL to get notified when:
 * - An audit completes (generate_report, site_audit, crawl_page)
 * - Usage reaches 80% or 100% of plan limit
 * - Scheduled audit runs (success or failure)
 * 
 * All webhooks include HMAC-SHA256 signature for verification.
 */

const WEBHOOK_TIMEOUT_MS = 10_000; // 10 second timeout
const MAX_RETRIES = 2;

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

// Lazy prepared statements — initialized on first use (after migrations)
let _getWebhookUrlStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _setWebhookUrlStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _insertDeliveryStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _getDeliveriesStmt: ReturnType<typeof sqlite.prepare> | null = null;

function getWebhookUrlStmt() {
  return _getWebhookUrlStmt ??= sqlite.prepare(
    "SELECT webhook_url FROM users WHERE id = ? AND webhook_url IS NOT NULL"
  );
}
function setWebhookUrlStmtFn() {
  return _setWebhookUrlStmt ??= sqlite.prepare(
    "UPDATE users SET webhook_url = ?, updated_at = ? WHERE id = ?"
  );
}
function insertDeliveryStmt() {
  return _insertDeliveryStmt ??= sqlite.prepare(
    `INSERT INTO webhook_deliveries (user_id, event, url, status_code, success, error, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
}
function getDeliveriesStmt() {
  return _getDeliveriesStmt ??= sqlite.prepare(
    `SELECT id, event, url, status_code, success, error, duration_ms, created_at
     FROM webhook_deliveries WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`
  );
}

/**
 * Get a user's webhook URL.
 */
export function getUserWebhookUrl(userId: string): string | null {
  const row = getWebhookUrlStmt().get(userId) as { webhook_url: string } | undefined;
  return row?.webhook_url || null;
}

/**
 * Set a user's webhook URL (null to disable).
 */
export function setUserWebhookUrl(userId: string, url: string | null): void {
  setWebhookUrlStmtFn().run(url, Date.now(), userId);
}

/**
 * Validate a webhook URL.
 */
export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { valid: false, error: "Webhook URL must use HTTPS or HTTP" };
    }
    // Block private/internal IPs (SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    if (isPrivateHost(hostname)) {
      return { valid: false, error: "Webhook URL cannot point to private/internal addresses" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

function isPrivateHost(hostname: string): boolean {
  // Strip IPv6 brackets
  const h = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("169.254.")) return true;
  // 172.16-31.x.x
  if (h.startsWith("172.")) {
    const second = parseInt(h.split(".")[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 private
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  // Cloud metadata
  if (h.endsWith(".internal") || h === "metadata.google.internal") return true;
  return false;
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Uses a per-user signing key derived from the global secret + userId.
 */
function signPayload(userId: string, body: string): string {
  const key = `${config.jwtSecret}:webhook:${userId}`;
  return createHmac("sha256", key).update(body).digest("hex");
}

/**
 * Log a webhook delivery attempt.
 */
function logDelivery(
  userId: string,
  event: string,
  url: string,
  statusCode: number | null,
  success: boolean,
  error: string | null,
  durationMs: number,
): void {
  try {
    insertDeliveryStmt().run(userId, event, url, statusCode, success ? 1 : 0, error, durationMs, Date.now());
  } catch (err) {
    console.error("Failed to log webhook delivery:", err);
  }
}

/**
 * Get recent webhook deliveries for a user.
 */
export function getWebhookDeliveries(userId: string, limit: number = 10): any[] {
  return getDeliveriesStmt().all(userId, Math.min(limit, 50)) as any[];
}

/**
 * Send a webhook notification (fire-and-forget with retries).
 */
export async function sendWebhook(userId: string, event: string, data: Record<string, any>): Promise<void> {
  const url = getUserWebhookUrl(userId);
  if (!url) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);
  const signature = signPayload(userId, body);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "seomcp.dev/webhook",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Timestamp": payload.timestamp,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      if (response.ok || response.status < 500) {
        logDelivery(userId, event, url, response.status, response.ok, null, durationMs);
        return;
      }
      // 5xx — retry
      if (attempt === MAX_RETRIES) {
        logDelivery(userId, event, url, response.status, false, `HTTP ${response.status}`, durationMs);
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (attempt === MAX_RETRIES) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        logDelivery(userId, event, url, null, false, errorMsg, durationMs);
        console.error(`Webhook failed for user ${userId} after ${MAX_RETRIES + 1} attempts:`, err);
      }
      // Brief delay before retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
}

/**
 * Send audit completion webhook.
 */
export function notifyAuditComplete(
  userId: string,
  toolName: string,
  siteUrl: string,
  healthScore: number | null,
  durationMs: number,
): void {
  // Fire-and-forget — don't await
  sendWebhook(userId, "audit.completed", {
    tool: toolName,
    siteUrl,
    healthScore,
    durationMs,
  }).catch(() => {}); // Suppress unhandled rejection
}

/**
 * Send usage alert webhook.
 */
export function notifyUsageAlert(
  userId: string,
  used: number,
  limit: number,
  threshold: number, // 0.8 or 1.0
): void {
  sendWebhook(userId, "usage.alert", {
    used,
    limit,
    percentage: Math.round(threshold * 100),
    message: threshold >= 1 ? "Monthly usage limit reached" : `Usage at ${Math.round(threshold * 100)}% of monthly limit`,
  }).catch(() => {});
}

/**
 * Send scheduled audit result webhook.
 */
export function notifyScheduledAuditResult(
  userId: string,
  scheduleId: string,
  toolName: string,
  siteUrl: string,
  healthScore: number | null,
  success: boolean,
  error?: string,
): void {
  sendWebhook(userId, success ? "scheduled_audit.completed" : "scheduled_audit.failed", {
    scheduleId,
    tool: toolName,
    siteUrl,
    healthScore,
    success,
    error: error || null,
  }).catch(() => {});
}

/**
 * Send test webhook.
 */
export function sendTestWebhook(userId: string): void {
  sendWebhook(userId, "test", {
    message: "This is a test webhook from seomcp.dev",
    timestamp: new Date().toISOString(),
  }).catch(() => {});
}
