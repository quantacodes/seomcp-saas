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

// Track which alerts have been sent this month (prevents duplicate emails)
const sentAlerts = new Map<string, Set<number>>(); // userId -> Set<threshold*100>

/**
 * Send usage alert webhook + email notification.
 * Webhook fires every time. Email fires once per threshold per month.
 */
export function notifyUsageAlert(
  userId: string,
  used: number,
  limit: number,
  threshold: number, // 0.8 or 1.0
): void {
  // Webhook (if configured) — always fires
  sendWebhook(userId, "usage.alert", {
    used,
    limit,
    percentage: Math.round(threshold * 100),
    message: threshold >= 1 ? "Monthly usage limit reached" : `Usage at ${Math.round(threshold * 100)}% of monthly limit`,
  }).catch(() => {});

  // Email — once per threshold per month
  const pctKey = Math.round(threshold * 100);
  const monthKey = `${userId}:${new Date().getFullYear()}-${new Date().getMonth()}`;
  if (!sentAlerts.has(monthKey)) sentAlerts.set(monthKey, new Set());
  const userAlerts = sentAlerts.get(monthKey)!;
  if (userAlerts.has(pctKey)) return; // Already sent this alert this month
  userAlerts.add(pctKey);

  sendUsageAlertEmail(userId, used, limit, threshold).catch((err) => {
    console.error("Failed to send usage alert email:", err);
  });
}

/**
 * Clear sent alerts (called monthly or on test).
 */
export function clearSentAlerts(): void {
  sentAlerts.clear();
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
 * Prune old webhook deliveries (keep last 100 per user, max 30 days).
 */
export function pruneWebhookDeliveries(): void {
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    sqlite.prepare("DELETE FROM webhook_deliveries WHERE created_at < ?").run(thirtyDaysAgo);
    // Keep max 100 per user
    sqlite.prepare(`
      DELETE FROM webhook_deliveries WHERE id IN (
        SELECT wd.id FROM webhook_deliveries wd
        WHERE wd.id NOT IN (
          SELECT id FROM webhook_deliveries WHERE user_id = wd.user_id ORDER BY created_at DESC LIMIT 100
        )
      )
    `).run();
  } catch (err) {
    console.error("Failed to prune webhook deliveries:", err);
  }
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

/**
 * Send usage alert email to user.
 * Only sends if RESEND_API_KEY is configured.
 */
async function sendUsageAlertEmail(
  userId: string,
  used: number,
  limit: number,
  threshold: number,
): Promise<void> {
  // Get user's email
  const user = sqlite.prepare("SELECT email, plan FROM users WHERE id = ?").get(userId) as
    | { email: string; plan: string }
    | undefined;

  if (!user) return;

  if (!config.resendApiKey) {
    console.log(`📧 Usage alert for ${user.email}: ${Math.round(threshold * 100)}% (${used}/${limit})`);
    return;
  }

  const percentage = Math.round(threshold * 100);
  const isAtLimit = threshold >= 1;
  const subject = isAtLimit
    ? "⚠️ Monthly usage limit reached — SEO MCP"
    : `📊 You've used ${percentage}% of your monthly quota — SEO MCP`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: user.email,
        subject,
        html: usageAlertEmailHtml(used, limit, percentage, user.plan, isAtLimit),
      }),
    });
  } catch (err) {
    console.error("Usage alert email error:", err);
  }
}

function usageAlertEmailHtml(
  used: number,
  limit: number,
  percentage: number,
  plan: string,
  isAtLimit: boolean,
): string {
  const base = config.baseUrl;
  const barWidth = Math.min(percentage, 100);
  const barColor = isAtLimit ? "#ef4444" : "#eab308";
  const remaining = Math.max(0, limit - used);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#38bdf8;font-size:24px;margin:0 0 8px;">🔍 SEO MCP</h1>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 24px;">
      ${isAtLimit ? "⚠️ Monthly limit reached" : `📊 ${percentage}% of your quota used`}
    </h2>

    <!-- Usage bar -->
    <div style="background:#0f172a;border-radius:8px;height:12px;overflow:hidden;margin:0 0 12px;">
      <div style="background:${barColor};height:100%;width:${barWidth}%;border-radius:8px;"></div>
    </div>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">
      <strong>${used.toLocaleString()}</strong> / ${limit.toLocaleString()} calls used
      ${isAtLimit ? "" : ` — <strong>${remaining.toLocaleString()}</strong> remaining`}
    </p>

    ${isAtLimit
      ? `<p style="color:#fbbf24;line-height:1.6;margin:0 0 24px;">
          Tool calls will be rejected until your quota resets at the start of next month.
          Upgrade your plan to continue using SEO tools without interruption.
        </p>`
      : `<p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
          You're approaching your monthly limit on the <strong>${plan}</strong> plan.
          Consider upgrading to avoid hitting the cap.
        </p>`
    }

    <a href="${base}/#pricing" style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;">
      ${plan === "free" ? "Upgrade to Pro — $29/mo" : "Upgrade Plan"}
    </a>

    <p style="color:#64748b;font-size:13px;margin:24px 0 0;">
      Current plan: ${plan} (${limit.toLocaleString()} calls/month).
      <a href="${base}/dashboard" style="color:#38bdf8;">View usage →</a>
    </p>
  </div>
</body>
</html>`;
}
