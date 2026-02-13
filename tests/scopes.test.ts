import { describe, it, expect } from "bun:test";
import {
  TOOL_CATEGORIES,
  VALID_SCOPES,
  buildAllowedTools,
  isToolAllowed,
  parseScopes,
  validateScopes,
  describeScopeAccess,
} from "../src/auth/scopes";

describe("Key Scoping — TOOL_CATEGORIES", () => {
  it("has expected categories", () => {
    expect(VALID_SCOPES).toContain("crawl");
    expect(VALID_SCOPES).toContain("gsc");
    expect(VALID_SCOPES).toContain("ga4");
    expect(VALID_SCOPES).toContain("schema");
    expect(VALID_SCOPES).toContain("indexnow");
    expect(VALID_SCOPES).toContain("report");
    expect(VALID_SCOPES).toContain("meta");
  });

  it("crawl category has correct tools", () => {
    expect(TOOL_CATEGORIES.crawl).toContain("site_audit");
    expect(TOOL_CATEGORIES.crawl).toContain("crawl_page");
    expect(TOOL_CATEGORIES.crawl).toContain("test_robots_txt");
  });

  it("gsc category has 8 tools", () => {
    expect(TOOL_CATEGORIES.gsc.length).toBe(8);
  });

  it("ga4 category has 8 tools", () => {
    expect(TOOL_CATEGORIES.ga4.length).toBe(8);
  });
});

describe("Key Scoping — buildAllowedTools", () => {
  it("returns null for null scopes (unrestricted)", () => {
    expect(buildAllowedTools(null)).toBeNull();
  });

  it("returns null for empty scopes", () => {
    expect(buildAllowedTools([])).toBeNull();
  });

  it("builds set from single category", () => {
    const allowed = buildAllowedTools(["crawl"]);
    expect(allowed).not.toBeNull();
    expect(allowed!.has("site_audit")).toBe(true);
    expect(allowed!.has("crawl_page")).toBe(true);
    expect(allowed!.has("gsc_performance")).toBe(false);
  });

  it("builds set from multiple categories", () => {
    const allowed = buildAllowedTools(["crawl", "gsc"]);
    expect(allowed).not.toBeNull();
    expect(allowed!.has("site_audit")).toBe(true);
    expect(allowed!.has("gsc_performance")).toBe(true);
    expect(allowed!.has("ga4_report")).toBe(false);
  });
});

describe("Key Scoping — isToolAllowed", () => {
  it("allows all tools with null scopes", () => {
    expect(isToolAllowed("site_audit", null)).toBe(true);
    expect(isToolAllowed("gsc_performance", null)).toBe(true);
    expect(isToolAllowed("anything", null)).toBe(true);
  });

  it("allows tools in scoped categories", () => {
    expect(isToolAllowed("site_audit", ["crawl"])).toBe(true);
    expect(isToolAllowed("crawl_page", ["crawl"])).toBe(true);
  });

  it("rejects tools outside scoped categories", () => {
    expect(isToolAllowed("gsc_performance", ["crawl"])).toBe(false);
    expect(isToolAllowed("ga4_report", ["crawl", "gsc"])).toBe(false);
  });
});

describe("Key Scoping — parseScopes", () => {
  it("returns null for null input", () => {
    expect(parseScopes(null)).toBeNull();
  });

  it("parses valid JSON array", () => {
    expect(parseScopes('["crawl","gsc"]')).toEqual(["crawl", "gsc"]);
  });

  it("filters out invalid categories", () => {
    expect(parseScopes('["crawl","invalid","gsc"]')).toEqual(["crawl", "gsc"]);
  });

  it("returns null for non-array JSON", () => {
    expect(parseScopes('"crawl"')).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseScopes("not json")).toBeNull();
  });
});

describe("Key Scoping — validateScopes", () => {
  it("accepts null (unrestricted)", () => {
    const result = validateScopes(null);
    expect(result.valid).toBe(true);
    expect(result.scopes).toBeNull();
  });

  it("accepts undefined (unrestricted)", () => {
    const result = validateScopes(undefined);
    expect(result.valid).toBe(true);
    expect(result.scopes).toBeNull();
  });

  it("accepts empty array (unrestricted)", () => {
    const result = validateScopes([]);
    expect(result.valid).toBe(true);
    expect(result.scopes).toBeNull();
  });

  it("accepts valid categories", () => {
    const result = validateScopes(["crawl", "gsc"]);
    expect(result.valid).toBe(true);
    expect(result.scopes).toEqual(["crawl", "gsc"]);
  });

  it("rejects non-array", () => {
    const result = validateScopes("crawl");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be an array");
  });

  it("rejects invalid categories", () => {
    const result = validateScopes(["crawl", "invalid"]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid");
  });
});

describe("Key Scoping — describeScopeAccess", () => {
  it("describes unrestricted", () => {
    expect(describeScopeAccess(null)).toBe("All tools");
  });

  it("describes single scope", () => {
    const desc = describeScopeAccess(["crawl"]);
    expect(desc).toContain("crawl");
    expect(desc).toContain("3 tools");
  });

  it("describes multiple scopes", () => {
    const desc = describeScopeAccess(["crawl", "gsc"]);
    expect(desc).toContain("crawl");
    expect(desc).toContain("gsc");
  });
});
