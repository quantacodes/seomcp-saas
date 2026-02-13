/**
 * @seomcp/proxy — Tool manifest cache
 *
 * Fetches tool manifest from cloud on startup, falls back to bundled manifest.
 * Caches in memory for the process lifetime.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchManifest } from "./client.js";

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolManifest {
  tools: ToolSchema[];
}

/** In-memory cached manifest */
let cachedManifest: ToolManifest | null = null;

/**
 * Load the bundled fallback manifest from tools-manifest.json.
 * This is compiled into the bundle or read at runtime.
 */
function loadFallbackManifest(): ToolManifest {
  try {
    // Try multiple paths — bundled vs dev vs installed
    const candidates = [
      // Relative to this file (dist/)
      resolve(dirname(fileURLToPath(import.meta.url)), "..", "tools-manifest.json"),
      // Relative to cwd
      resolve(process.cwd(), "tools-manifest.json"),
      // Relative to this file (src/)
      resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "tools-manifest.json"),
    ];

    for (const candidate of candidates) {
      try {
        const raw = readFileSync(candidate, "utf-8");
        return JSON.parse(raw) as ToolManifest;
      } catch {
        continue;
      }
    }

    throw new Error("tools-manifest.json not found");
  } catch (err) {
    process.stderr.write(
      `⚠️  Failed to load fallback manifest: ${(err as Error).message}\n`,
    );
    return { tools: [] };
  }
}

/**
 * Initialize the tool manifest.
 * Tries cloud first, falls back to bundled.
 * Non-blocking — always returns a manifest.
 */
export async function initManifest(apiKey?: string): Promise<ToolManifest> {
  if (cachedManifest) return cachedManifest;

  try {
    const result = await fetchManifest(apiKey);

    if (result.ok && result.status === 200) {
      const body = result.body as { tools?: unknown[] };
      if (body && Array.isArray(body.tools) && body.tools.length > 0) {
        cachedManifest = body as ToolManifest;
        return cachedManifest;
      }
    }
  } catch {
    // Cloud fetch failed — fall through to bundled
  }

  process.stderr.write(
    "ℹ️  Using bundled tool manifest (cloud manifest unavailable)\n",
  );
  cachedManifest = loadFallbackManifest();
  return cachedManifest;
}

/** Get the cached manifest (must call initManifest first) */
export function getManifest(): ToolManifest {
  if (!cachedManifest) {
    cachedManifest = loadFallbackManifest();
  }
  return cachedManifest;
}

/** Reset cache (for testing) */
export function resetManifestCache(): void {
  cachedManifest = null;
}
