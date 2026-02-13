import { sqlite } from "../db/index";
import { config } from "../config";
import { binaryPool } from "../mcp/binary";
import { captureAudit, extractSiteUrl } from "../audit/history";
import { logUsage } from "../usage/tracker";
import { checkAndIncrementRateLimit } from "../ratelimit/middleware";
import { notifyScheduledAuditResult, pruneWebhookDeliveries } from "../webhooks/user-webhooks";
import {
  getUserConfigPath as getPerUserConfigPath,
  writeUserConfig,
  hasUserConfig,
} from "../config/user-config";
import { decryptToken } from "../crypto/tokens";

/**
 * Scheduled Audit Engine
 * 
 * Polls every 60 seconds for due scheduled audits, runs them via the
 * seo-mcp binary, stores results in audit_history, and sends webhooks.
 * 
 * Concurrency: max 3 concurrent runs to avoid resource exhaustion.
 * Timeout: 5 minutes per audit run.
 */

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_CONCURRENT_RUNS = 3;
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeRuns = 0;

// Lazy prepared statements — initialized on first use (after migrations)
let _getDueAuditsStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _updateAfterRunStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _countUserSchedulesStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _getScheduleByIdStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _getSchedulesStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _insertScheduleStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _updateScheduleStmt: ReturnType<typeof sqlite.prepare> | null = null;
let _deleteScheduleStmt: ReturnType<typeof sqlite.prepare> | null = null;

function getDueAuditsStmt() {
  return _getDueAuditsStmt ??= sqlite.prepare(`
    SELECT sa.*, u.email, u.plan, ak.key_hash
    FROM scheduled_audits sa
    JOIN users u ON sa.user_id = u.id
    JOIN api_keys ak ON sa.api_key_id = ak.id
    WHERE sa.is_active = 1 
      AND sa.next_run_at <= ?
      AND ak.is_active = 1
    ORDER BY sa.next_run_at ASC
    LIMIT ?
  `);
}
function getUpdateAfterRunStmt() {
  return _updateAfterRunStmt ??= sqlite.prepare(`
    UPDATE scheduled_audits 
    SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1, last_error = ?, updated_at = ?
    WHERE id = ?
  `);
}
function getCountUserSchedulesStmt() {
  return _countUserSchedulesStmt ??= sqlite.prepare(
    "SELECT COUNT(*) as cnt FROM scheduled_audits WHERE user_id = ?"
  );
}
function getScheduleByIdStmtFn() {
  return _getScheduleByIdStmt ??= sqlite.prepare(
    "SELECT * FROM scheduled_audits WHERE id = ? AND user_id = ?"
  );
}
function getSchedulesStmtFn() {
  return _getSchedulesStmt ??= sqlite.prepare(
    "SELECT * FROM scheduled_audits WHERE user_id = ? ORDER BY created_at DESC"
  );
}
function getInsertScheduleStmt() {
  return _insertScheduleStmt ??= sqlite.prepare(`
    INSERT INTO scheduled_audits (id, user_id, api_key_id, site_url, tool_name, schedule, schedule_hour, schedule_day, is_active, next_run_at, run_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
  `);
}
function getUpdateScheduleStmt() {
  return _updateScheduleStmt ??= sqlite.prepare(`
    UPDATE scheduled_audits SET is_active = ?, schedule = ?, schedule_hour = ?, schedule_day = ?, next_run_at = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `);
}
function getDeleteScheduleStmt() {
  return _deleteScheduleStmt ??= sqlite.prepare(
    "DELETE FROM scheduled_audits WHERE id = ? AND user_id = ?"
  );
}

/**
 * Calculate the next run timestamp based on schedule type.
 */
export function calculateNextRun(schedule: string, hour: number, day?: number | null): number {
  const now = new Date();
  const next = new Date();
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hour);

  switch (schedule) {
    case "daily":
      if (next.getTime() <= now.getTime()) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      break;

    case "weekly": {
      // day = 0-6 (Mon=0, Sun=6)
      // JS getUTCDay: 0=Sun, 1=Mon ... 6=Sat
      const targetJsDay = ((day ?? 0) + 1) % 7; // Convert Mon=0 to JS format
      while (next.getUTCDay() !== targetJsDay || next.getTime() <= now.getTime()) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      break;
    }

    case "monthly":
      next.setUTCDate(Math.min(day ?? 1, 28)); // Cap at 28 to avoid month overflow
      if (next.getTime() <= now.getTime()) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }
      break;

    default:
      // Fallback to daily
      if (next.getTime() <= now.getTime()) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
  }

  return next.getTime();
}

/**
 * Validate schedule parameters.
 */
export function validateSchedule(schedule: string, hour: number, day?: number | null): { valid: boolean; error?: string } {
  if (!["daily", "weekly", "monthly"].includes(schedule)) {
    return { valid: false, error: "Schedule must be 'daily', 'weekly', or 'monthly'" };
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { valid: false, error: "Hour must be 0-23 (UTC)" };
  }
  if (schedule === "weekly" && day != null && (!Number.isInteger(day) || day < 0 || day > 6)) {
    return { valid: false, error: "Day of week must be 0-6 (Mon=0, Sun=6)" };
  }
  if (schedule === "monthly" && day != null && (!Number.isInteger(day) || day < 1 || day > 28)) {
    return { valid: false, error: "Day of month must be 1-28" };
  }
  return { valid: true };
}

/**
 * Get user config path for binary, ensuring Google tokens are available.
 */
function getUserConfigPath(userId: string): string {
  // Validate userId
  if (!/^[A-Z0-9]{26,32}$/.test(userId)) {
    throw new Error("Invalid user ID format");
  }

  const tokenRow = sqlite.prepare(
    "SELECT access_token_enc, refresh_token_enc, expires_at FROM google_tokens WHERE user_id = ?"
  ).get(userId) as { access_token_enc: string; refresh_token_enc: string; expires_at: number } | undefined;

  if (tokenRow) {
    try {
      const accessToken = decryptToken(tokenRow.access_token_enc);
      const refreshToken = decryptToken(tokenRow.refresh_token_enc);
      writeUserConfig(userId, {
        accessToken,
        refreshToken,
        expiresAt: tokenRow.expires_at,
      });
    } catch {
      writeUserConfig(userId);
    }
  } else if (!hasUserConfig(userId)) {
    writeUserConfig(userId);
  }

  return getPerUserConfigPath(userId);
}

/**
 * Run a single scheduled audit.
 */
async function runScheduledAudit(audit: any): Promise<void> {
  const now = Date.now();
  let healthScore: number | null = null;
  let errorMsg: string | null = null;
  let success = false;

  try {
    // Get binary instance for this user
    const configPath = getUserConfigPath(audit.user_id);
    const binary = binaryPool.getInstance(audit.user_id, configPath);
    await binary.ensureReady();

    // Check rate limit (scheduled audits consume quota)
    const rateCheck = checkAndIncrementRateLimit({
      userId: audit.user_id,
      email: audit.email,
      plan: audit.plan,
      apiKeyId: audit.api_key_id,
      scopes: null,
    });

    if (!rateCheck.allowed) {
      errorMsg = `Rate limit exceeded (${rateCheck.used}/${rateCheck.limit} calls this month)`;
      logUsage(
        { userId: audit.user_id, email: audit.email, plan: audit.plan, apiKeyId: audit.api_key_id, scopes: null },
        audit.tool_name,
        "rate_limited",
        0,
      );
    } else {
      // Build the MCP tool call
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "tools/call",
        params: {
          name: audit.tool_name,
          arguments: { site_url: audit.site_url },
        },
      };

      // Binary has its own 60s timeout per request
      // Use Promise.race for the 5-minute outer timeout
      try {
        const response = await Promise.race([
          binary.send(request),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Scheduled audit timed out after 5 minutes")), RUN_TIMEOUT_MS)
          ),
        ]);

        const durationMs = Date.now() - now;

        if (response.error) {
          errorMsg = response.error.message || "Tool returned error";
          logUsage(
            { userId: audit.user_id, email: audit.email, plan: audit.plan, apiKeyId: audit.api_key_id, scopes: null },
            audit.tool_name,
            "error",
            durationMs,
          );
        } else {
          success = true;
          logUsage(
            { userId: audit.user_id, email: audit.email, plan: audit.plan, apiKeyId: audit.api_key_id, scopes: null },
            audit.tool_name,
            "success",
            durationMs,
          );

          // Capture in audit history
          captureAudit(
            audit.user_id,
            audit.api_key_id,
            audit.tool_name,
            { site_url: audit.site_url },
            response.result,
            durationMs,
            audit.plan,
          );

          // Extract health score from result for webhook
          const text = JSON.stringify(response.result);
          const match = text.match(/[Hh]ealth\s*[Ss]core[:\s]*(\d{1,3})/);
          if (match) healthScore = parseInt(match[1], 10);
        }
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Run timed out";
        const durationMs = Date.now() - now;
        logUsage(
          { userId: audit.user_id, email: audit.email, plan: audit.plan, apiKeyId: audit.api_key_id, scopes: null },
          audit.tool_name,
          "error",
          durationMs,
        );
      }
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Unknown error";
  }

  // Update schedule: next run + status
  const nextRun = calculateNextRun(audit.schedule, audit.schedule_hour, audit.schedule_day);
  getUpdateAfterRunStmt().run(now, nextRun, errorMsg, now, audit.id);

  // Send webhook notification
  notifyScheduledAuditResult(
    audit.user_id,
    audit.id,
    audit.tool_name,
    audit.site_url,
    healthScore,
    success,
    errorMsg || undefined,
  );

  console.log(JSON.stringify({
    level: success ? "info" : "warn",
    msg: "scheduled_audit_run",
    ts: new Date().toISOString(),
    scheduleId: audit.id,
    userId: audit.user_id,
    site: audit.site_url,
    tool: audit.tool_name,
    success,
    error: errorMsg,
    healthScore,
  }));
}

// Prune webhook deliveries every ~10 minutes (every 10th poll)
let pollCount = 0;

/**
 * Poll for due audits and run them.
 */
async function pollAndRun(): Promise<void> {
  // Periodic housekeeping (every ~10 minutes)
  pollCount++;
  if (pollCount % 10 === 0) {
    try { pruneWebhookDeliveries(); } catch { /* non-critical */ }
  }

  const slotsAvailable = MAX_CONCURRENT_RUNS - activeRuns;
  if (slotsAvailable <= 0) return;

  const dueAudits = getDueAuditsStmt().all(Date.now(), slotsAvailable) as any[];
  if (dueAudits.length === 0) return;

  for (const audit of dueAudits) {
    activeRuns++;
    // Run in background (fire-and-forget per audit)
    runScheduledAudit(audit)
      .catch((err) => console.error("Scheduled audit run failed:", err))
      .finally(() => { activeRuns--; });
  }
}

/**
 * Start the scheduler.
 */
export function startScheduler(): void {
  if (pollTimer) return; // Already running
  console.log("📅 Scheduler started (polling every 60s)");
  pollTimer = setInterval(pollAndRun, POLL_INTERVAL_MS);
  // Run immediately on start
  pollAndRun().catch((err) => console.error("Initial scheduler poll failed:", err));
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("📅 Scheduler stopped");
  }
}

// ── CRUD operations for dashboard ──

/**
 * Count a user's scheduled audits.
 */
export function countUserSchedules(userId: string): number {
  const row = getCountUserSchedulesStmt().get(userId) as { cnt: number } | undefined;
  return row?.cnt || 0;
}

/**
 * Get all schedules for a user.
 */
export function getUserSchedules(userId: string): any[] {
  return getSchedulesStmtFn().all(userId) as any[];
}

/**
 * Get a specific schedule by ID.
 */
export function getScheduleById(scheduleId: string, userId: string): any | null {
  return getScheduleByIdStmtFn().get(scheduleId, userId) || null;
}

/**
 * Create a new scheduled audit.
 */
export function createSchedule(
  id: string,
  userId: string,
  apiKeyId: string,
  siteUrl: string,
  toolName: string,
  schedule: string,
  hour: number,
  day: number | null,
): void {
  const now = Date.now();
  const nextRun = calculateNextRun(schedule, hour, day);
  getInsertScheduleStmt().run(id, userId, apiKeyId, siteUrl, toolName, schedule, hour, day, nextRun, now, now);
}

/**
 * Update a scheduled audit.
 */
export function updateSchedule(
  scheduleId: string,
  userId: string,
  isActive: boolean,
  schedule: string,
  hour: number,
  day: number | null,
): void {
  const now = Date.now();
  const nextRun = isActive ? calculateNextRun(schedule, hour, day) : 0;
  getUpdateScheduleStmt().run(isActive ? 1 : 0, schedule, hour, day, nextRun, now, scheduleId, userId);
}

/**
 * Delete a scheduled audit.
 */
export function deleteSchedule(scheduleId: string, userId: string): boolean {
  const result = getDeleteScheduleStmt().run(scheduleId, userId);
  return result.changes > 0;
}

/**
 * Run a specific schedule immediately (manual trigger).
 * Returns without waiting — result comes via webhook/audit history.
 */
export async function runScheduleNow(scheduleId: string, userId: string): Promise<boolean> {
  const audit = getScheduleByIdStmtFn().get(scheduleId, userId) as any;
  if (!audit) return false;

  // Get user info for the run
  const user = sqlite.prepare("SELECT email, plan FROM users WHERE id = ?").get(userId) as { email: string; plan: string } | undefined;
  if (!user) return false;

  // Merge user info into audit object
  const fullAudit = { ...audit, email: user.email, plan: user.plan };

  // Run in background
  activeRuns++;
  runScheduledAudit(fullAudit)
    .catch((err) => console.error("Manual audit run failed:", err))
    .finally(() => { activeRuns--; });

  return true;
}

/**
 * Get scheduler status.
 */
export function getSchedulerStatus(): { running: boolean; activeRuns: number; maxConcurrent: number } {
  return {
    running: pollTimer !== null,
    activeRuns,
    maxConcurrent: MAX_CONCURRENT_RUNS,
  };
}
