import { describe, it, expect } from "bun:test";

// Set test DB before imports
process.env.DATABASE_PATH = "./data/test-landing.db";

import { Hono } from "hono";
import { landingRoutes } from "../src/routes/landing";

const app = new Hono();
app.route("/", landingRoutes);

const req = (path: string) => app.request(`http://localhost${path}`);

describe("Landing page", () => {
  it("serves HTML at /", async () => {
    const res = await req("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("seomcp.dev");
  });

  it("has correct title and meta tags", async () => {
    const res = await req("/");
    const html = await res.text();
    expect(html).toContain("<title>seomcp.dev — 35 SEO Tools for Any AI Agent | MCP Server</title>");
    expect(html).toContain('name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
  });

  it("includes all major sections", async () => {
    const res = await req("/");
    const html = await res.text();
    // Hero
    expect(html).toContain("Give any AI agent");
    expect(html).toContain("SEO superpowers");
    // How it works
    expect(html).toContain("Three steps. Under a minute.");
    // Real data section
    expect(html).toContain("Your real Google data");
    // Tools grid
    expect(html).toContain("35 tools. Every SEO workflow.");
    expect(html).toContain("site_audit");
    expect(html).toContain("gsc_performance");
    expect(html).toContain("ga4_report");
    expect(html).toContain("indexnow_submit_url");
    expect(html).toContain("generate_report");
    // Comparison table
    expect(html).toContain("Stop overpaying for SEO data");
    // Pricing
    expect(html).toContain("Simple, transparent pricing");
    expect(html).toContain("$0");
    expect(html).toContain("$29");
    expect(html).toContain("$79");
    // FAQ
    expect(html).toContain("Frequently asked questions");
    expect(html).toContain("What is MCP?");
    // CTA
    expect(html).toContain("Get Free API Key");
    // Footer
    expect(html).toContain("QuantaCodes");
  });

  it("includes signup form JavaScript", async () => {
    const res = await req("/");
    const html = await res.text();
    expect(html).toContain("handleSignup");
    expect(html).toContain("openSignup");
    expect(html).toContain("/api/auth/signup");
  });

  it("includes MCP config snippet", async () => {
    const res = await req("/");
    const html = await res.text();
    expect(html).toContain("https://seomcp.dev/mcp");
    expect(html).toContain("sk_live_REDACTED_key");
    expect(html).toContain("mcpServers");
  });

  it("does not serve /docs (handled by docsRoutes)", async () => {
    const res = await req("/docs");
    // landingRoutes no longer handles /docs — it returns 404 in isolation
    expect(res.status).toBe(404);
  });
});
