/**
 * @seomcp/proxy — Core proxy integration tests
 *
 * Tests CLI commands, version management, and manifest loading.
 */

import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import { join } from "node:path";
import { VERSION, compareSemver } from "../src/version.js";
import { getManifest, resetManifestCache } from "../src/manifest.js";

const SRC = join(import.meta.dir, "..", "src", "index.ts");

/** Run the CLI with given args and return stdout + exit code */
async function runCli(
  args: string[] = [],
  env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = spawn({
    cmd: ["bun", "run", SRC, ...args],
    stdout: "pipe",
    stderr: "pipe",
    stdin: "pipe",
    env: { ...process.env, ...env },
    cwd: join(import.meta.dir, ".."),
  });

  // Close stdin immediately for non-server commands
  proc.stdin.end();

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("CLI commands", () => {
  test("version prints version string", async () => {
    const { stdout, exitCode } = await runCli(["version"]);
    expect(stdout.trim()).toBe(VERSION);
    expect(exitCode).toBe(0);
  });

  test("--version prints version string", async () => {
    const { stdout, exitCode } = await runCli(["--version"]);
    expect(stdout.trim()).toBe(VERSION);
    expect(exitCode).toBe(0);
  });

  test("--help prints usage info", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    expect(stdout).toContain("seomcp-proxy");
    expect(stdout).toContain("USAGE");
    expect(stdout).toContain("ENVIRONMENT VARIABLES");
    expect(stdout).toContain("SEOMCP_API_KEY");
    expect(stdout).toContain("GOOGLE_SERVICE_ACCOUNT");
    expect(exitCode).toBe(0);
  });

  test("help prints usage info", async () => {
    const { stdout, exitCode } = await runCli(["help"]);
    expect(stdout).toContain("USAGE");
    expect(exitCode).toBe(0);
  });

  test("test subcommand checks configuration", async () => {
    const { stdout, exitCode } = await runCli(["test"], {
      SEOMCP_API_KEY: "",
      GOOGLE_SERVICE_ACCOUNT: "",
    });
    expect(stdout).toContain("❌");
    expect(exitCode).toBe(1);
  });

  test("test subcommand shows all check labels", async () => {
    const { stdout } = await runCli(["test"], {
      SEOMCP_API_KEY: "",
      GOOGLE_SERVICE_ACCOUNT: "",
    });
    expect(stdout).toContain("SEOMCP_API_KEY");
    expect(stdout).toContain("GOOGLE_SERVICE_ACCOUNT");
    expect(stdout).toContain("Service account JSON");
  });
});

describe("version comparison", () => {
  test("equal versions", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  });

  test("major version difference", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
  });

  test("minor version difference", () => {
    expect(compareSemver("1.1.0", "1.2.0")).toBe(-1);
    expect(compareSemver("1.2.0", "1.1.0")).toBe(1);
  });

  test("patch version difference", () => {
    expect(compareSemver("1.0.1", "1.0.2")).toBe(-1);
    expect(compareSemver("1.0.2", "1.0.1")).toBe(1);
  });

  test("complex comparison", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBe(-1);
    expect(compareSemver("1.0.0", "0.99.99")).toBe(1);
  });
});

describe("manifest", () => {
  test("getManifest returns bundled manifest", () => {
    resetManifestCache();
    const manifest = getManifest();
    expect(manifest).toBeDefined();
    expect(Array.isArray(manifest.tools)).toBe(true);
    expect(manifest.tools.length).toBe(37);
  });

  test("manifest tools have correct shape", () => {
    resetManifestCache();
    const manifest = getManifest();

    for (const tool of manifest.tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
    }
  });

  test("manifest contains all expected tool categories", () => {
    resetManifestCache();
    const manifest = getManifest();
    const names = manifest.tools.map((t) => t.name);

    // Crawl tools
    expect(names).toContain("site_audit");
    expect(names).toContain("crawl_page");
    expect(names).toContain("test_robots_txt");

    // GSC tools
    expect(names).toContain("gsc_performance");
    expect(names).toContain("gsc_list_sites");
    expect(names).toContain("gsc_list_sitemaps");
    expect(names).toContain("gsc_submit_sitemap");
    expect(names).toContain("gsc_delete_sitemap");
    expect(names).toContain("gsc_inspect_url");
    expect(names).toContain("gsc_bulk_inspect");
    expect(names).toContain("gsc_search_appearances");

    // GA4 tools
    expect(names).toContain("ga4_report");
    expect(names).toContain("ga4_batch_report");
    expect(names).toContain("ga4_funnel_report");
    expect(names).toContain("ga4_realtime");
    expect(names).toContain("ga4_metadata");
    expect(names).toContain("ga4_overview");
    expect(names).toContain("ga4_top_pages");
    expect(names).toContain("ga4_traffic_sources");
    expect(names).toContain("ga4_devices");
    expect(names).toContain("ga4_geography");

    // CWV
    expect(names).toContain("core_web_vitals");

    // Schema
    expect(names).toContain("validate_schema");
    expect(names).toContain("analyze_robots_txt");

    // Sitemaps
    expect(names).toContain("sitemap_index_diff");

    // IndexNow
    expect(names).toContain("indexnow_submit_url");
    expect(names).toContain("indexnow_batch_submit");
    expect(names).toContain("indexnow_submit_sitemap");
    expect(names).toContain("indexnow_submit_file");

    // Google Indexing
    expect(names).toContain("google_indexing_submit_url");
    expect(names).toContain("google_indexing_batch_submit");
    expect(names).toContain("google_indexing_submit_sitemap");
    expect(names).toContain("google_indexing_submit_file");

    // Utility
    expect(names).toContain("quota_status");
    expect(names).toContain("healthcheck");

    // Report
    expect(names).toContain("generate_report");

    // Meta
    expect(names).toContain("version");
  });
});
