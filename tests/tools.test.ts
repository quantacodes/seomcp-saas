import { describe, test, expect } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

const testDbPath = "./data/test-tools.db";
process.env.DATABASE_PATH = testDbPath;

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

const { Hono } = await import("hono");
const { runMigrations } = await import("../src/db/migrate");
const { toolsRoutes } = await import("../src/routes/tools");
const { openapiRoutes } = await import("../src/routes/openapi");

runMigrations();

const app = new Hono();
app.route("/", toolsRoutes);
app.route("/", openapiRoutes);

async function req(path: string) {
  return app.fetch(new Request(`http://localhost${path}`));
}

describe("Tools Catalog Page", () => {
  test("GET /tools returns HTML", async () => {
    const res = await req("/tools");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("SEO Tools for AI Agents");
  });

  test("/tools contains all tool categories", async () => {
    const res = await req("/tools");
    const html = await res.text();
    expect(html).toContain("Crawling & Audit");
    expect(html).toContain("Google Search Console");
    expect(html).toContain("Google Analytics 4");
    expect(html).toContain("Core Web Vitals");
    expect(html).toContain("IndexNow");
    expect(html).toContain("Schema & Structured Data");
  });

  test("/tools contains specific tool names", async () => {
    const res = await req("/tools");
    const html = await res.text();
    expect(html).toContain("generate_report");
    expect(html).toContain("site_audit");
    expect(html).toContain("gsc_performance");
    expect(html).toContain("ga4_report");
    expect(html).toContain("core_web_vitals");
    expect(html).toContain("validate_schema");
    expect(html).toContain("indexnow_submit_url");
  });

  test("/tools has proper SEO meta tags", async () => {
    const res = await req("/tools");
    const html = await res.text();
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<link rel="canonical"');
  });

  test("/tools shows tier badges", async () => {
    const res = await req("/tools");
    const html = await res.text();
    expect(html).toContain("No OAuth needed");
    expect(html).toContain("Requires Google OAuth");
  });
});

describe("Tools JSON API", () => {
  test("GET /api/tools returns structured data", async () => {
    const res = await req("/api/tools");
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;

    expect(data.total).toBeGreaterThanOrEqual(25); // 29 in catalog
    expect(data.freeTools).toBeGreaterThanOrEqual(8);
    expect(data.googleTools).toBeGreaterThanOrEqual(15);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(Array.isArray(data.tools)).toBe(true);
  });

  test("/api/tools includes tool details", async () => {
    const res = await req("/api/tools");
    const data = (await res.json()) as any;

    const siteAudit = data.tools.find((t: any) => t.name === "site_audit");
    expect(siteAudit).toBeDefined();
    expect(siteAudit.description).toContain("Crawl");
    expect(siteAudit.category).toBe("crawl");
    expect(Array.isArray(siteAudit.params)).toBe(true);
    expect(siteAudit.params.length).toBeGreaterThanOrEqual(1);
  });

  test("/api/tools params have correct structure", async () => {
    const res = await req("/api/tools");
    const data = (await res.json()) as any;

    const gscPerf = data.tools.find((t: any) => t.name === "gsc_performance");
    expect(gscPerf.params.length).toBeGreaterThanOrEqual(3);

    const siteUrlParam = gscPerf.params.find((p: any) => p.name === "site_url");
    expect(siteUrlParam.type).toBe("string");
    expect(siteUrlParam.required).toBe(true);
    expect(siteUrlParam.description).toBeTruthy();
  });
});

describe("OpenAPI Spec", () => {
  test("GET /openapi.json returns valid spec", async () => {
    const res = await req("/openapi.json");
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;

    expect(data.openapi).toBe("3.1.0");
    expect(data.info.title).toBe("SEO MCP API");
    expect(data.paths["/mcp"]).toBeDefined();
    expect(data.paths["/mcp"].post).toBeDefined();
    expect(data.components.securitySchemes.bearerAuth).toBeDefined();
  });

  test("/openapi.json includes auth endpoints", async () => {
    const res = await req("/openapi.json");
    const data = (await res.json()) as any;

    expect(data.paths["/api/auth/signup"]).toBeDefined();
    expect(data.paths["/api/auth/login"]).toBeDefined();
  });

  test("/openapi.json includes MCP examples", async () => {
    const res = await req("/openapi.json");
    const data = (await res.json()) as any;

    const mcpExamples = data.paths["/mcp"].post.requestBody.content["application/json"].examples;
    expect(mcpExamples.initialize).toBeDefined();
    expect(mcpExamples.toolCall).toBeDefined();
  });
});
