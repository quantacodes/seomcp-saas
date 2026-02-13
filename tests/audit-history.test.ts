import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { sqlite } from "../src/db/index";
import { runMigrations } from "../src/db/migrate";
import {
  shouldCapture,
  extractSiteUrl,
  captureAudit,
  getAuditHistory,
  getAuditById,
  getAuditSites,
  getHealthTrend,
  getRetentionLimits,
} from "../src/audit/history";

// Setup test data
const TEST_USER_ID = "01TEST_AUDIT_USER_ABCDEF";
const TEST_KEY_ID = "01TEST_AUDIT_KEY_ABCDEFG";

beforeAll(() => {
  runMigrations();
  // Ensure test user + key exist
  sqlite.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(TEST_USER_ID, "audit-test@test.com", "hash", "pro", Date.now(), Date.now());
  sqlite.prepare("INSERT OR IGNORE INTO api_keys (id, user_id, key_hash, key_prefix, name, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(TEST_KEY_ID, TEST_USER_ID, "testhash_audit", "sk_live_REDACTED", "Test", 1, Date.now());
});

afterAll(() => {
  sqlite.prepare("DELETE FROM audit_history WHERE user_id = ?").run(TEST_USER_ID);
  sqlite.prepare("DELETE FROM api_keys WHERE id = ?").run(TEST_KEY_ID);
  sqlite.prepare("DELETE FROM users WHERE id = ?").run(TEST_USER_ID);
});

describe("Audit History — shouldCapture", () => {
  it("captures generate_report", () => {
    expect(shouldCapture("generate_report")).toBe(true);
  });

  it("captures site_audit", () => {
    expect(shouldCapture("site_audit")).toBe(true);
  });

  it("captures crawl_page", () => {
    expect(shouldCapture("crawl_page")).toBe(true);
  });

  it("does not capture gsc_performance", () => {
    expect(shouldCapture("gsc_performance")).toBe(false);
  });

  it("does not capture version", () => {
    expect(shouldCapture("version")).toBe(false);
  });
});

describe("Audit History — extractSiteUrl", () => {
  it("extracts site_url from generate_report params", () => {
    expect(extractSiteUrl("generate_report", { site_url: "example.com" })).toBe("example.com");
  });

  it("extracts url from crawl_page params", () => {
    expect(extractSiteUrl("crawl_page", { url: "https://example.com/page" })).toBe("https://example.com/page");
  });

  it("returns null for missing params", () => {
    expect(extractSiteUrl("generate_report", {})).toBeNull();
  });
});

describe("Audit History — captureAudit", () => {
  it("stores an audit record", () => {
    const mockResult = {
      content: [{ text: "Health Score: 87/100\n5 pages crawled\n2 issues found" }],
    };

    captureAudit(TEST_USER_ID, TEST_KEY_ID, "generate_report", { site_url: "example.com" }, mockResult, 1500, "pro");

    const audits = getAuditHistory(TEST_USER_ID);
    expect(audits.length).toBeGreaterThan(0);
    const latest = audits[0];
    expect(latest.tool_name).toBe("generate_report");
    expect(latest.site_url).toBe("example.com");
    expect(latest.health_score).toBe(87);
    expect(latest.duration_ms).toBe(1500);
  });

  it("stores summary as JSON", () => {
    const mockResult = {
      content: [{ text: "Health Score: 92/100\n10 pages crawled\n3 issues found" }],
    };

    captureAudit(TEST_USER_ID, TEST_KEY_ID, "generate_report", { site_url: "test-summary.com" }, mockResult, 2000, "pro");

    const audits = getAuditHistory(TEST_USER_ID, { siteUrl: "test-summary.com" });
    expect(audits.length).toBe(1);
    const summary = JSON.parse(audits[0].summary);
    expect(summary.healthScore).toBe(92);
    expect(summary.pagesCrawled).toBe(10);
    expect(summary.issuesFound).toBe(3);
  });

  it("skips capture when no site_url in params", () => {
    const before = getAuditHistory(TEST_USER_ID).length;
    captureAudit(TEST_USER_ID, TEST_KEY_ID, "generate_report", {}, {}, 100, "pro");
    const after = getAuditHistory(TEST_USER_ID).length;
    expect(after).toBe(before); // No new record
  });

  it("handles null health score gracefully", () => {
    captureAudit(TEST_USER_ID, TEST_KEY_ID, "crawl_page", { url: "https://nohealth.com" }, { content: [{ text: "Status: 200" }] }, 500, "pro");
    const audits = getAuditHistory(TEST_USER_ID, { siteUrl: "https://nohealth.com" });
    expect(audits.length).toBe(1);
    expect(audits[0].health_score).toBeNull();
  });
});

describe("Audit History — getAuditById", () => {
  it("returns full audit result", () => {
    const audits = getAuditHistory(TEST_USER_ID);
    if (audits.length > 0) {
      const full = getAuditById(TEST_USER_ID, audits[0].id);
      expect(full).not.toBeNull();
      expect(full.full_result).toBeDefined();
      expect(typeof full.full_result).toBe("string");
    }
  });

  it("returns null for non-existent audit", () => {
    expect(getAuditById(TEST_USER_ID, 99999)).toBeNull();
  });

  it("returns null for other user's audit", () => {
    const audits = getAuditHistory(TEST_USER_ID);
    if (audits.length > 0) {
      expect(getAuditById("OTHER_USER_ID_HERE_AAAA", audits[0].id)).toBeNull();
    }
  });
});

describe("Audit History — getAuditSites", () => {
  it("returns unique sites", () => {
    const sites = getAuditSites(TEST_USER_ID);
    expect(sites.length).toBeGreaterThan(0);
    expect(sites[0].site_url).toBeDefined();
    expect(sites[0].audit_count).toBeGreaterThan(0);
  });
});

describe("Audit History — getHealthTrend", () => {
  it("returns data points for a site with health scores", () => {
    const trend = getHealthTrend(TEST_USER_ID, "example.com", 30);
    expect(trend.length).toBeGreaterThan(0);
    expect(trend[0].health_score).toBeDefined();
  });

  it("returns empty for non-existent site", () => {
    const trend = getHealthTrend(TEST_USER_ID, "nonexistent.com", 30);
    expect(trend.length).toBe(0);
  });
});

describe("Audit History — retention limits", () => {
  it("returns correct limits per plan", () => {
    expect(getRetentionLimits("free")).toEqual({ maxAudits: 10, retentionDays: 7 });
    expect(getRetentionLimits("pro")).toEqual({ maxAudits: 100, retentionDays: 30 });
    expect(getRetentionLimits("agency")).toEqual({ maxAudits: 1000, retentionDays: 90 });
  });

  it("defaults to free for unknown plan", () => {
    expect(getRetentionLimits("unknown")).toEqual({ maxAudits: 10, retentionDays: 7 });
  });
});
