/**
 * Tool category definitions for key scoping.
 * Keys can be restricted to specific tool categories.
 * null scopes = unrestricted (all tools allowed).
 */

export const TOOL_CATEGORIES: Record<string, string[]> = {
  crawl: ["site_audit", "crawl_page", "test_robots_txt"],
  gsc: [
    "gsc_performance",
    "gsc_list_sites",
    "gsc_list_sitemaps",
    "gsc_submit_sitemap",
    "gsc_delete_sitemap",
    "gsc_inspect_url",
    "gsc_bulk_inspect",
    "gsc_search_appearances",
  ],
  ga4: [
    "ga4_report",
    "ga4_realtime",
    "ga4_metadata",
    "ga4_overview",
    "ga4_top_pages",
    "ga4_traffic_sources",
    "ga4_devices",
    "ga4_geography",
  ],
  schema: ["validate_schema", "analyze_robots_txt"],
  indexnow: [
    "indexnow_submit_url",
    "indexnow_batch_submit",
    "indexnow_submit_sitemap",
    "indexnow_submit_file",
  ],
  cwv: ["core_web_vitals"],
  report: ["generate_report"],
  storage: ["sitemap_index_diff"],
  meta: ["version"],
} as const;

/**
 * All valid scope category names.
 */
export const VALID_SCOPES = Object.keys(TOOL_CATEGORIES);

/**
 * Build a Set of allowed tool names from scope categories.
 * Returns null if scopes is null (unrestricted).
 */
export function buildAllowedTools(scopes: string[] | null): Set<string> | null {
  if (!scopes || scopes.length === 0) return null; // unrestricted

  const allowed = new Set<string>();
  for (const scope of scopes) {
    const tools = TOOL_CATEGORIES[scope];
    if (tools) {
      for (const tool of tools) {
        allowed.add(tool);
      }
    }
  }
  return allowed;
}

/**
 * Check if a tool name is allowed by the given scopes.
 * Returns true if scopes is null (unrestricted) or tool is in allowed categories.
 */
export function isToolAllowed(toolName: string, scopes: string[] | null): boolean {
  if (!scopes || scopes.length === 0) return true; // unrestricted
  const allowed = buildAllowedTools(scopes);
  return allowed ? allowed.has(toolName) : true;
}

/**
 * Parse scopes from JSON string (from DB).
 */
export function parseScopes(scopesJson: string | null): string[] | null {
  if (!scopesJson) return null;
  try {
    const parsed = JSON.parse(scopesJson);
    if (!Array.isArray(parsed)) return null;
    // Validate each scope is a known category
    return parsed.filter((s: any) => typeof s === "string" && TOOL_CATEGORIES[s]);
  } catch {
    return null;
  }
}

/**
 * Validate scopes array from user input.
 * Returns cleaned array or null for unrestricted.
 */
export function validateScopes(scopes: any): { valid: boolean; scopes: string[] | null; error?: string } {
  if (scopes === undefined || scopes === null) {
    return { valid: true, scopes: null };
  }

  if (!Array.isArray(scopes)) {
    return { valid: false, scopes: null, error: "scopes must be an array of categories" };
  }

  if (scopes.length === 0) {
    return { valid: true, scopes: null }; // empty = unrestricted
  }

  const invalid = scopes.filter((s: any) => typeof s !== "string" || !TOOL_CATEGORIES[s]);
  if (invalid.length > 0) {
    return {
      valid: false,
      scopes: null,
      error: `Invalid scopes: ${invalid.join(", ")}. Valid: ${VALID_SCOPES.join(", ")}`,
    };
  }

  return { valid: true, scopes: scopes as string[] };
}

/**
 * Get human-readable description of scopes.
 */
export function describeScopeAccess(scopes: string[] | null): string {
  if (!scopes || scopes.length === 0) return "All tools";
  return scopes.map((s) => {
    const count = TOOL_CATEGORIES[s]?.length || 0;
    return `${s} (${count} tools)`;
  }).join(", ");
}
