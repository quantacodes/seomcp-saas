import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Dynamic imports to avoid side effects
const { runMigrations } = await import("../src/db/migrate");
const { sqlite } = await import("../src/db/index");
const { createSession } = await import("../src/auth/session");
const { ulid } = await import("../src/utils/ulid");
const { changelogRoutes } = await import("../src/routes/changelog");
const { auditRoutes } = await import("../src/routes/audits");
const { healthRoutes } = await import("../src/routes/health");
const { legalRoutes } = await import("../src/routes/legal");
const { docsRoutes } = await import("../src/routes/docs");

runMigrations();

// Create mini app with just the routes we need
const app = new Hono();
app.use("*", cors());
app.route("/", healthRoutes);
app.route("/", changelogRoutes);
app.route("/", auditRoutes);
app.route("/", docsRoutes);
app.route("/", legalRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helpers
function req(path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

function withCookie(sessionId: string): Record<string, string> {
  return { Cookie: `session=${sessionId}` };
}

// Create test user and session
const TEST_USER_ID = ulid();
const TEST_KEY_ID = ulid();
let testSessionId: string;

beforeAll(async () => {
  // Create user
  const pw = await Bun.password.hash("testpass123", { algorithm: "bcrypt" });
  sqlite.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(TEST_USER_ID, "changelog-audit@test.com", pw, "pro", Date.now(), Date.now());

  // Create API key
  sqlite.prepare("INSERT OR IGNORE INTO api_keys (id, user_id, key_hash, key_prefix, name, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(TEST_KEY_ID, TEST_USER_ID, "hash_clog_" + TEST_KEY_ID, "sk_live_REDACTED", "Test", 1, Date.now());

  // Create session
  testSessionId = createSession(TEST_USER_ID);

  // Create test audit records
  for (let i = 0; i < 3; i++) {
    sqlite.prepare(`INSERT INTO audit_history (user_id, api_key_id, tool_name, site_url, health_score, summary, full_result, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        TEST_USER_ID,
        TEST_KEY_ID,
        "generate_report",
        "apitest.com",
        85 + i,
        JSON.stringify({ healthScore: 85 + i }),
        JSON.stringify({ content: [{ text: `Report #${i}` }] }),
        1000 + i * 100,
        Date.now() - i * 1000 * 60 * 60,
      );
  }
});

afterAll(() => {
  sqlite.prepare("DELETE FROM audit_history WHERE user_id = ?").run(TEST_USER_ID);
  sqlite.prepare("DELETE FROM sessions WHERE user_id = ?").run(TEST_USER_ID);
  sqlite.prepare("DELETE FROM api_keys WHERE user_id = ?").run(TEST_USER_ID);
  sqlite.prepare("DELETE FROM users WHERE id = ?").run(TEST_USER_ID);
});

// ── Changelog ──

describe("Changelog page", () => {
  it("renders changelog HTML", async () => {
    const res = await req("/changelog");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Changelog");
    expect(html).toContain("v0.1.0");
    expect(html).toContain("Initial Launch");
  });

  it("has OG tags", async () => {
    const res = await req("/changelog");
    const html = await res.text();
    expect(html).toContain("og:title");
    expect(html).toContain("twitter:card");
  });

  it("has v0.2.0 entry", async () => {
    const res = await req("/changelog");
    const html = await res.text();
    expect(html).toContain("v0.2.0");
    expect(html).toContain("Audit History");
  });

  it("appears in sitemap", async () => {
    const res = await req("/sitemap.xml");
    const xml = await res.text();
    expect(xml).toContain("seomcp.dev/changelog");
  });
});

// ── Audit API ──

describe("Audit API — /dashboard/api/audits", () => {
  it("requires auth", async () => {
    const res = await req("/dashboard/api/audits");
    expect(res.status).toBe(401);
  });

  it("lists audits for authenticated user", async () => {
    const res = await req("/dashboard/api/audits", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.audits).toBeDefined();
    expect(data.audits.length).toBe(3);
    expect(data.retention.plan).toBe("pro");
    expect(data.retention.maxAudits).toBe(100);
  });

  it("filters by site_url", async () => {
    const res = await req("/dashboard/api/audits?site_url=apitest.com", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.audits.length).toBe(3);
    expect(data.audits.every((a: any) => a.siteUrl === "apitest.com")).toBe(true);
  });

  it("paginates with limit/offset", async () => {
    const res = await req("/dashboard/api/audits?limit=1&offset=0", {
      headers: withCookie(testSessionId),
    });
    const data = await res.json();
    expect(data.audits.length).toBe(1);
    expect(data.pagination.limit).toBe(1);
    expect(data.pagination.offset).toBe(0);
  });

  it("returns empty for unknown site", async () => {
    const res = await req("/dashboard/api/audits?site_url=nonexistent.com", {
      headers: withCookie(testSessionId),
    });
    const data = await res.json();
    expect(data.audits.length).toBe(0);
  });
});

describe("Audit API — /dashboard/api/audits/sites", () => {
  it("lists unique sites", async () => {
    const res = await req("/dashboard/api/audits/sites", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sites.length).toBeGreaterThan(0);
    const site = data.sites.find((s: any) => s.siteUrl === "apitest.com");
    expect(site).toBeDefined();
    expect(site.auditCount).toBe(3);
  });
});

describe("Audit API — /dashboard/api/audits/:id", () => {
  it("returns full audit by ID", async () => {
    // Get list first
    const listRes = await req("/dashboard/api/audits?limit=1", {
      headers: withCookie(testSessionId),
    });
    const list = await listRes.json();
    const auditId = list.audits[0].id;

    const res = await req(`/dashboard/api/audits/${auditId}`, {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fullResult).toBeDefined();
    expect(data.toolName).toBe("generate_report");
  });

  it("returns 404 for non-existent audit", async () => {
    const res = await req("/dashboard/api/audits/99999", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid audit ID", async () => {
    const res = await req("/dashboard/api/audits/abc", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(400);
  });
});

describe("Audit API — /dashboard/api/audits/trend", () => {
  it("returns health trend for a site", async () => {
    const res = await req("/dashboard/api/audits/trend?site_url=apitest.com", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.dataPoints.length).toBe(3);
    expect(data.siteUrl).toBe("apitest.com");
  });

  it("requires site_url parameter", async () => {
    const res = await req("/dashboard/api/audits/trend", {
      headers: withCookie(testSessionId),
    });
    expect(res.status).toBe(400);
  });
});

// ── OG tags ──

describe("OG tags on pages", () => {
  it("docs page has OG tags", async () => {
    const res = await req("/docs");
    const html = await res.text();
    expect(html).toContain("og:title");
    expect(html).toContain("twitter:card");
  });

  it("terms page has OG tags", async () => {
    const res = await req("/terms");
    const html = await res.text();
    expect(html).toContain("og:title");
  });

  it("privacy page has OG tags", async () => {
    const res = await req("/privacy");
    const html = await res.text();
    expect(html).toContain("og:title");
  });
});
