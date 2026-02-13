import { sqlite } from "../db/index";
import { config } from "../config";

/**
 * Tools whose results get captured into audit_history.
 */
const CAPTURED_TOOLS = new Set([
  "generate_report",
  "site_audit",
  "crawl_page",
]);

/**
 * Plan-based retention limits.
 */
const RETENTION_LIMITS: Record<string, { maxAudits: number; retentionDays: number }> = {
  free: { maxAudits: 10, retentionDays: 7 },
  pro: { maxAudits: 100, retentionDays: 30 },
  agency: { maxAudits: 1000, retentionDays: 90 },
  enterprise: { maxAudits: 10000, retentionDays: 365 },
};

/**
 * Check if a tool call should be captured for audit history.
 */
export function shouldCapture(toolName: string): boolean {
  return CAPTURED_TOOLS.has(toolName);
}

/**
 * Extract the site URL from tool call params.
 */
export function extractSiteUrl(toolName: string, params: Record<string, any>): string | null {
  // generate_report and site_audit use site_url
  if (params.site_url) return String(params.site_url);
  // crawl_page uses url
  if (params.url) return String(params.url);
  return null;
}

/**
 * Extract health score from a generate_report response.
 */
function extractHealthScore(result: any): number | null {
  if (!result) return null;
  try {
    // The result is typically in result.content[0].text as a markdown report
    const text = typeof result === "string" ? result : JSON.stringify(result);
    // Look for "Health Score: XX/100" pattern
    const match = text.match(/[Hh]ealth\s*[Ss]core[:\s]*(\d{1,3})\s*\/?\s*100/);
    if (match) return parseInt(match[1], 10);
    // Also check for numeric health_score field
    if (typeof result === "object") {
      if (result.health_score != null) return Number(result.health_score);
      if (result.content?.[0]?.text) {
        const innerMatch = result.content[0].text.match(/[Hh]ealth\s*[Ss]core[:\s]*(\d{1,3})/);
        if (innerMatch) return parseInt(innerMatch[1], 10);
      }
    }
  } catch {
    // Non-critical — return null
  }
  return null;
}

/**
 * Extract summary metrics from a tool result.
 */
function extractSummary(toolName: string, result: any): Record<string, any> | null {
  try {
    const summary: Record<string, any> = {};
    const text = typeof result === "object" && result.content?.[0]?.text
      ? result.content[0].text
      : typeof result === "string" ? result : JSON.stringify(result);

    if (toolName === "generate_report") {
      const scoreMatch = text.match(/[Hh]ealth\s*[Ss]core[:\s]*(\d{1,3})/);
      if (scoreMatch) summary.healthScore = parseInt(scoreMatch[1], 10);
      const pagesMatch = text.match(/(\d+)\s*pages?\s*crawled/i);
      if (pagesMatch) summary.pagesCrawled = parseInt(pagesMatch[1], 10);
      const issuesMatch = text.match(/(\d+)\s*issues?\s*found/i);
      if (issuesMatch) summary.issuesFound = parseInt(issuesMatch[1], 10);
    } else if (toolName === "site_audit") {
      const pagesMatch = text.match(/(\d+)\s*pages?\s*(crawled|audited)/i);
      if (pagesMatch) summary.pagesCrawled = parseInt(pagesMatch[1], 10);
      const errorsMatch = text.match(/(\d+)\s*errors?/i);
      if (errorsMatch) summary.errors = parseInt(errorsMatch[1], 10);
    } else if (toolName === "crawl_page") {
      summary.toolName = "crawl_page";
      const statusMatch = text.match(/[Ss]tatus[:\s]*(\d{3})/);
      if (statusMatch) summary.statusCode = parseInt(statusMatch[1], 10);
    }

    return Object.keys(summary).length > 0 ? summary : null;
  } catch {
    return null;
  }
}

const insertStmt = sqlite.prepare(`
  INSERT INTO audit_history (user_id, api_key_id, tool_name, site_url, health_score, summary, full_result, duration_ms, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const countStmt = sqlite.prepare(
  `SELECT COUNT(*) as cnt FROM audit_history WHERE user_id = ?`
);

const pruneOldStmt = sqlite.prepare(`
  DELETE FROM audit_history WHERE user_id = ? AND created_at < ?
`);

const pruneExcessStmt = sqlite.prepare(`
  DELETE FROM audit_history WHERE user_id = ? AND id NOT IN (
    SELECT id FROM audit_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  )
`);

// Max full_result size: 512KB (prevents DB bloat from massive crawl results)
const MAX_RESULT_BYTES = 512 * 1024;

/**
 * Capture a tool result into audit history.
 * Fire-and-forget — errors are logged but don't affect the response.
 */
export function captureAudit(
  userId: string,
  apiKeyId: string,
  toolName: string,
  params: Record<string, any>,
  result: any,
  durationMs: number,
  plan: string,
): void {
  try {
    const siteUrl = extractSiteUrl(toolName, params);
    if (!siteUrl) return; // Can't store without a site URL

    const healthScore = extractHealthScore(result);
    const summary = extractSummary(toolName, result);
    let fullResult = JSON.stringify(result);
    // Truncate oversized results to prevent DB bloat
    if (fullResult.length > MAX_RESULT_BYTES) {
      fullResult = JSON.stringify({ _truncated: true, _originalSize: fullResult.length, summary: summary || "Result too large to store" });
    }
    const now = new Date();

    insertStmt.run(
      userId,
      apiKeyId,
      toolName,
      siteUrl,
      healthScore,
      summary ? JSON.stringify(summary) : null,
      fullResult,
      durationMs,
      now.getTime(),
    );

    // Enforce retention limits
    const limits = RETENTION_LIMITS[plan] || RETENTION_LIMITS.free;
    const cutoff = new Date(now.getTime() - limits.retentionDays * 24 * 60 * 60 * 1000);
    pruneOldStmt.run(userId, cutoff.getTime());
    pruneExcessStmt.run(userId, userId, limits.maxAudits);
  } catch (err) {
    console.error("Failed to capture audit:", err);
  }
}

/**
 * Get audit history for a user.
 */
export function getAuditHistory(
  userId: string,
  options: { siteUrl?: string; limit?: number; offset?: number } = {},
): any[] {
  const limit = Math.min(options.limit || 20, 100);
  const offset = options.offset || 0;

  if (options.siteUrl) {
    return sqlite
      .prepare(
        `SELECT id, tool_name, site_url, health_score, summary, duration_ms, created_at
         FROM audit_history WHERE user_id = ? AND site_url = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(userId, options.siteUrl, limit, offset) as any[];
  }

  return sqlite
    .prepare(
      `SELECT id, tool_name, site_url, health_score, summary, duration_ms, created_at
       FROM audit_history WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset) as any[];
}

/**
 * Get full audit result by ID.
 */
export function getAuditById(userId: string, auditId: number): any | null {
  return sqlite
    .prepare(
      `SELECT * FROM audit_history WHERE id = ? AND user_id = ?`,
    )
    .get(auditId, userId) || null;
}

/**
 * Get unique sites with their latest health scores.
 * Uses subquery to get the score from the most recent audit, not the highest.
 */
export function getAuditSites(userId: string): any[] {
  return sqlite
    .prepare(
      `SELECT site_url, 
              (SELECT health_score FROM audit_history ah2 
               WHERE ah2.user_id = audit_history.user_id 
               AND ah2.site_url = audit_history.site_url 
               ORDER BY created_at DESC LIMIT 1) as latest_score,
              COUNT(*) as audit_count,
              MAX(created_at) as last_audit_at
       FROM audit_history 
       WHERE user_id = ?
       GROUP BY site_url
       ORDER BY last_audit_at DESC`,
    )
    .all(userId) as any[];
}

/**
 * Get health score trend for a site.
 */
export function getHealthTrend(userId: string, siteUrl: string, days: number = 30): any[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return sqlite
    .prepare(
      `SELECT health_score, created_at
       FROM audit_history 
       WHERE user_id = ? AND site_url = ? AND health_score IS NOT NULL AND created_at >= ?
       ORDER BY created_at ASC`,
    )
    .all(userId, siteUrl, cutoff.getTime()) as any[];
}

/**
 * Get retention limits for a plan.
 */
export function getRetentionLimits(plan: string) {
  return RETENTION_LIMITS[plan] || RETENTION_LIMITS.free;
}
