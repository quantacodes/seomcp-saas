import { describe, it, expect } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-playground.db";
process.env.DATABASE_PATH = testDbPath;

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

const { Hono } = await import("hono");
const { runMigrations } = await import("../src/db/migrate");
const { playgroundRoutes } = await import("../src/routes/playground");

runMigrations();

const app = new Hono();
app.route("/", playgroundRoutes);

const req = (path: string, opts?: RequestInit) =>
  app.request(path, opts);

describe("Playground page", () => {
  it("GET /playground returns HTML with tool selectors", async () => {
    const res = await req("/playground");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Playground");
    expect(html).toContain('data-tool="crawl_page"');
    expect(html).toContain('data-tool="validate_schema"');
    expect(html).toContain('data-tool="core_web_vitals"');
  });

  it("has proper SEO meta tags", async () => {
    const res = await req("/playground");
    const html = await res.text();
    expect(html).toContain("<title>Playground");
    expect(html).toContain('meta name="description"');
    expect(html).toContain('link rel="canonical"');
    expect(html).toContain("seomcp.dev/playground");
  });

  it("has CTA to sign up", async () => {
    const res = await req("/playground");
    const html = await res.text();
    expect(html).toContain("Sign up free");
    expect(html).toContain("/#pricing");
  });
});

describe("Playground API validation", () => {
  it("rejects missing tool", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: { url: "https://example.com" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("tool");
  });

  it("rejects non-demo tools", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "gsc_performance", args: {} }),
    });
    expect(res.status).toBe(403);
    const data = await res.json() as { error: string; hint: string };
    expect(data.error).toContain("not available in the demo");
    expect(data.hint).toContain("Sign up");
  });

  it("rejects crawl_page without URL", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: {} }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("url");
  });

  it("rejects validate_schema without URL or schema", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "validate_schema", args: {} }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("url");
  });

  it("rejects core_web_vitals without URL", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "core_web_vitals", args: {} }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("url");
  });

  it("blocks localhost URLs", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://localhost:8080" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks 127.0.0.1 URLs", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://127.0.0.1:3000" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks cloud metadata URLs", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://metadata.google.internal/computeMetadata/v1/" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks 192.168.x.x URLs", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://192.168.1.1" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks 10.x.x.x URLs", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://10.0.0.1" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks IPv6 loopback [::1]", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://[::1]:8080/" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks 169.254.x.x link-local URLs", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://169.254.169.254/latest/meta-data/" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("blocks 172.17.x.x (full /12 range)", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "http://172.31.0.1" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("private");
  });

  it("rejects invalid URL format", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "not-a-url" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Invalid URL");
  });

  it("rejects non-http protocols", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "crawl_page", args: { url: "ftp://example.com/file" } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("http");
  });

  it("rejects invalid JSON body", async () => {
    const res = await req("/api/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{{",
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Invalid JSON");
  });
});
