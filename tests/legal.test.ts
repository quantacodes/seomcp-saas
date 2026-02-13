import { describe, it, expect } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

const testDbPath = "./data/test-legal.db";
process.env.DATABASE_PATH = testDbPath;

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);

const { Hono } = await import("hono");
const { runMigrations } = await import("../src/db/migrate");
const { legalRoutes } = await import("../src/routes/legal");
const { healthRoutes } = await import("../src/routes/health");

runMigrations();

const app = new Hono();
app.route("/", healthRoutes);
app.route("/", legalRoutes);

describe("Terms of Service", () => {
  it("serves terms page", async () => {
    const res = await app.request("/terms");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Terms of Service");
    expect(html).toContain("seomcp.dev");
  });

  it("includes required legal sections", async () => {
    const res = await app.request("/terms");
    const html = await res.text();
    expect(html).toContain("Acceptable Use");
    expect(html).toContain("Google Data");
    expect(html).toContain("Billing");
    expect(html).toContain("Limitation of Liability");
    expect(html).toContain("Termination");
  });

  it("has canonical URL", async () => {
    const res = await app.request("/terms");
    const html = await res.text();
    expect(html).toContain('href="https://seomcp.dev/terms"');
  });
});

describe("Privacy Policy", () => {
  it("serves privacy page", async () => {
    const res = await app.request("/privacy");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("seomcp.dev");
  });

  it("includes Google data handling section", async () => {
    const res = await app.request("/privacy");
    const html = await res.text();
    expect(html).toContain("Google Data");
    expect(html).toContain("AES-256-GCM");
    expect(html).toContain("webmasters.readonly");
    expect(html).toContain("analytics.readonly");
    expect(html).toContain("Google API Services User Data Policy");
  });

  it("documents what is NOT collected", async () => {
    const res = await app.request("/privacy");
    const html = await res.text();
    expect(html).toContain("DON'T Collect");
    expect(html).toContain("don't sell your data");
  });

  it("includes data table", async () => {
    const res = await app.request("/privacy");
    const html = await res.text();
    expect(html).toContain("Email");
    expect(html).toContain("Password hash");
    expect(html).toContain("OAuth tokens");
    expect(html).toContain("API usage logs");
  });

  it("has canonical URL", async () => {
    const res = await app.request("/privacy");
    const html = await res.text();
    expect(html).toContain('href="https://seomcp.dev/privacy"');
  });
});

describe("Sitemap includes legal pages", () => {
  it("sitemap has terms and privacy", async () => {
    const res = await app.request("/sitemap.xml");
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("https://seomcp.dev/terms");
    expect(xml).toContain("https://seomcp.dev/privacy");
  });
});
