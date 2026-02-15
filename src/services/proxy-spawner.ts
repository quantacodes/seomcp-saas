/**
 * Per-request binary spawner for proxy API.
 *
 * Each call:
 * 1. Writes TWO temp files: SA JSON + TOML config
 * 2. Spawns the Rust binary with SEO_MCP_CONFIG pointing to the TOML
 * 3. Sends MCP initialize + tools/call via stdin
 * 4. Reads response from stdout
 * 5. Kills process + deletes temp files in `finally`
 */

import { spawn, type Subprocess } from "bun";
import { writeFileSync, unlinkSync, existsSync, chmodSync } from "fs";
import { join } from "path";
import os from "os";
import { config } from "../config";
import type { JsonRpcResponse } from "../types";

/** Where to write temp credential files: /dev/shm on Linux (RAM), tmpdir on macOS */
const TEMP_DIR = existsSync("/dev/shm") ? "/dev/shm" : os.tmpdir();

export type SpawnResult =
  | { ok: true; content: unknown }
  | { ok: false; status: number; error: string; code: string };

interface Credentials {
  google_service_account: Record<string, unknown>;
  gsc_property?: string;
  ga4_property?: string;
}

/**
 * Extract domain from a GSC property string.
 * "sc-domain:example.com" → "example.com"
 * "https://example.com/" → "example.com"
 */
function extractDomain(gscProperty?: string): string {
  if (!gscProperty) return "unknown";
  if (gscProperty.startsWith("sc-domain:")) {
    return gscProperty.slice("sc-domain:".length);
  }
  try {
    return new URL(gscProperty).hostname;
  } catch {
    return gscProperty;
  }
}

/**
 * Escape a string value for TOML basic strings.
 * Handles backslashes and double quotes.
 */
function escapeToml(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Parse comma-separated GSC property string into array.
 * Supports formats:
 *   - "example.com,blog.example.com" (domains - auto-adds sc-domain:)
 *   - "sc-domain:example.com,https://example.com/" (full property URLs)
 * Returns normalized GSC property format.
 */
function parseGscProperties(value?: string): string[] {
  if (!value) return [];
  
  return value.split(",").map(p => p.trim()).filter(Boolean).map(item => {
    // Already has prefix
    if (item.startsWith("sc-domain:") || item.startsWith("http://") || item.startsWith("https://")) {
      return item;
    }
    // Plain domain - add sc-domain: prefix
    return `sc-domain:${item}`;
  });
}

/**
 * Parse GA4 properties with optional domain mapping.
 * Supports formats:
 *   - "properties/123,properties/456" (legacy, position-based)
 *   - "123:example.com,456:blog.example.com" (explicit mapping)
 *   - "properties/123:example.com,properties/456:blog.example.com" (explicit mapping)
 * Returns array of { propertyId, domain? }
 */
function parseGa4Properties(value?: string): Array<{ propertyId: string; domain?: string }> {
  if (!value) return [];
  
  return value.split(",").map(p => p.trim()).filter(Boolean).map(item => {
    // Check for explicit domain mapping with ':' separator
    const colonIndex = item.indexOf(':');
    if (colonIndex > 0) {
      const propertyPart = item.slice(0, colonIndex).trim();
      const domainPart = item.slice(colonIndex + 1).trim();
      
      // Normalize property ID (ensure properties/ prefix)
      const propertyId = propertyPart.startsWith('properties/') 
        ? propertyPart 
        : `properties/${propertyPart}`;
      
      return { propertyId, domain: domainPart };
    }
    
    // No domain mapping - legacy format
    const propertyId = item.startsWith('properties/') ? item : `properties/${item}`;
    return { propertyId };
  });
}

/**
 * Validate property configuration and return any issues found.
 * Returns array of error/warning messages.
 */
export function validatePropertyConfig(credentials: Credentials): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const gscProps = parseGscProperties(credentials.gsc_property);
  const ga4Props = parseGa4Properties(credentials.ga4_property);
  
  // Check if using old singular env vars
  if (credentials.gsc_property && !credentials.gsc_property.includes(',') && !ga4Props.length) {
    warnings.push("Using legacy GSC_PROPERTY format. Consider using GSC_PROPERTIES for multiple properties.");
  }
  
  // Check if GA4 properties have domain mapping
  if (ga4Props.length > 0) {
    const withoutMapping = ga4Props.filter(p => !p.domain);
    if (withoutMapping.length > 0) {
      errors.push(
        `GA4 properties missing domain mapping: ${withoutMapping.map(p => p.propertyId).join(', ')}. ` +
        `Use format: "propertyID:domain" (e.g., "123456789:example.com")`
      );
    }
    
    // Check for mismatched domains between GSC and GA4
    if (gscProps.length > 0) {
      const gscDomains = gscProps.map(gsc => {
        if (gsc.startsWith('sc-domain:')) return gsc.slice('sc-domain:'.length);
        try {
          return new URL(gsc).hostname;
        } catch {
          return gsc;
        }
      });
      
      const ga4Domains = ga4Props.map(ga4 => ga4.domain).filter(Boolean);
      
      // Check for GA4 domains not in GSC
      for (const ga4Domain of ga4Domains) {
        if (!gscDomains.includes(ga4Domain)) {
          warnings.push(
            `Domain "${ga4Domain}" in GA4_PROPERTIES not found in GSC_PROPERTIES. ` +
            `Make sure to add "${ga4Domain}" to GSC_PROPERTIES if you want GSC data for this site.`
          );
        }
      }
      
      // Check for GSC domains not in GA4
      for (const gscDomain of gscDomains) {
        if (!ga4Domains.includes(gscDomain)) {
          warnings.push(
            `Domain "${gscDomain}" in GSC_PROPERTIES not found in GA4_PROPERTIES. ` +
            `Add "propertyID:${gscDomain}" to GA4_PROPERTIES to enable GA4 data for this site.`
          );
        }
      }
    }
  }
  
  // Check count mismatch
  if (gscProps.length > 0 && ga4Props.length > 0 && gscProps.length !== ga4Props.length) {
    warnings.push(
      `Property count mismatch: ${gscProps.length} GSC properties, ${ga4Props.length} GA4 properties. ` +
      `Make sure each domain has both GSC and GA4 configured.`
    );
  }
  
  // Check for empty properties
  if (credentials.gsc_property && gscProps.length === 0) {
    errors.push("GSC_PROPERTIES is set but contains no valid properties.");
  }
  if (credentials.ga4_property && ga4Props.length === 0) {
    errors.push("GA4_PROPERTIES is set but contains no valid properties.");
  }
  
  // Check property ID format
  for (const ga4 of ga4Props) {
    const id = ga4.propertyId.replace('properties/', '');
    if (!/^\d+$/.test(id)) {
      errors.push(`Invalid GA4 property ID "${id}". Property ID should be numeric (e.g., 123456789).`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Build TOML config string for the Rust binary.
 * Supports explicit domain mapping with format: propertyId:domain
 */
function buildToml(saFilePath: string, credentials: Credentials): string {
  const lines: string[] = [
    "[credentials]",
    `google_service_account = "${escapeToml(saFilePath)}"`,
    "",
  ];

  // Parse properties
  const gscProps = parseGscProperties(credentials.gsc_property);
  const ga4Props = parseGa4Properties(credentials.ga4_property);
  
  // Build sites - use explicit mapping or fall back to position-based pairing
  const maxSites = Math.max(gscProps.length, ga4Props.length, 1);
  
  for (let i = 0; i < maxSites; i++) {
    const gscProp = gscProps[i];
    const ga4Prop = ga4Props[i];
    
    // Determine domain:
    // 1. Use explicit domain from GA4 mapping if available
    // 2. Extract from GSC property
    // 3. Extract from GA4 property ID (as fallback)
    let domain: string;
    let siteName: string;
    
    if (ga4Prop?.domain) {
      // Explicit domain mapping: "522355930:happeningnownext.com"
      domain = ga4Prop.domain;
      siteName = ga4Prop.domain;
    } else if (gscProp) {
      // Extract from GSC property
      domain = extractDomain(gscProp);
      siteName = domain;
    } else if (ga4Prop) {
      // Fallback to property ID for naming
      domain = `property-${i + 1}`;
      siteName = domain;
    } else {
      domain = `site-${i + 1}`;
      siteName = domain;
    }
    
    lines.push("[[sites]]");
    lines.push(`name = "${escapeToml(siteName)}"`);
    lines.push(`domain = "${escapeToml(domain)}"`);
    
    if (gscProp) {
      lines.push(`gsc_property = "${escapeToml(gscProp)}"`);
    }
    if (ga4Prop) {
      lines.push(`ga4_property_id = "${escapeToml(ga4Prop.propertyId)}"`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

/**
 * Read newline-delimited JSON-RPC responses from a ReadableStream.
 * Returns the first response with the matching `id`.
 */
async function readResponse(
  stdout: ReadableStream<Uint8Array>,
  expectedId: string | number,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<JsonRpcResponse> {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Binary response timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    signal.addEventListener("abort", () => clearTimeout(timer));
  });

  const readPromise = (async (): Promise<JsonRpcResponse> => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Binary stdout closed before response");

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);

          if (!line) continue;

          try {
            const msg = JSON.parse(line) as JsonRpcResponse;
            if (msg.id === expectedId) {
              return msg;
            }
          } catch {
            // Non-JSON output (binary logs) — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return Promise.race([readPromise, timeoutPromise]);
}

/**
 * Write a JSON-RPC message to the binary's stdin.
 */
function writeMessage(stdin: WritableStream<Uint8Array> & { write(data: string | Uint8Array): number; flush(): void } | any, message: object): void {
  const line = JSON.stringify(message) + "\n";
  stdin.write(line);
  stdin.flush();
}

/**
 * Spawn the Rust binary for a single proxy request.
 * Creates temp files, communicates via JSON-RPC over stdin/stdout,
 * and ensures cleanup in all cases.
 */
export async function spawnForProxyRequest(
  toolName: string,
  args: Record<string, unknown>,
  credentials: Credentials,
  timeoutMs: number,
): Promise<SpawnResult> {
  const uuid = crypto.randomUUID();
  const saPath = join(TEMP_DIR, `seomcp-${uuid}-sa.json`);
  const tomlPath = join(TEMP_DIR, `seomcp-${uuid}.toml`);
  let proc: Subprocess | null = null;
  const ac = new AbortController();

  try {
    // 1. Write temp SA JSON
    writeFileSync(saPath, JSON.stringify(credentials.google_service_account), { mode: 0o600 });

    // 2. Write temp TOML config
    const toml = buildToml(saPath, credentials);
    writeFileSync(tomlPath, toml, { mode: 0o600 });

    // 3. Spawn binary
    proc = spawn({
      cmd: [config.seoMcpBinary],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        SEO_MCP_CONFIG: tomlPath,
        RUST_LOG: "warn",
      },
    });

    // Drain stderr (don't let it block)
    drainStderr(proc);

    // 4. MCP initialize
    writeMessage(proc.stdin, {
      jsonrpc: "2.0",
      id: "__proxy_init__",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "seo-mcp-proxy", version: "0.1.0" },
      },
    });

    const initResponse = await readResponse(
      proc.stdout as ReadableStream<Uint8Array>,
      "__proxy_init__",
      Math.min(timeoutMs, 10_000), // Init should be fast
      ac.signal,
    );

    if (initResponse.error) {
      return {
        ok: false,
        status: 500,
        error: `MCP init failed: ${initResponse.error.message}`,
        code: "BINARY_INIT_FAILED",
      };
    }

    // Send initialized notification
    writeMessage(proc.stdin, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // 5. tools/call
    writeMessage(proc.stdin, {
      jsonrpc: "2.0",
      id: "__proxy_call__",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    });

    const callResponse = await readResponse(
      proc.stdout as ReadableStream<Uint8Array>,
      "__proxy_call__",
      timeoutMs,
      ac.signal,
    );

    if (callResponse.error) {
      // Map known error patterns to HTTP status codes
      const errMsg = callResponse.error.message || "";
      const errData = typeof callResponse.error.data === "string" ? callResponse.error.data : "";
      const combined = `${errMsg} ${errData}`.toLowerCase();

      if (combined.includes("permission") || combined.includes("forbidden") || combined.includes("403")) {
        return { ok: false, status: 403, error: errMsg, code: "GOOGLE_PERMISSION_ERROR" };
      }
      if (combined.includes("unauthorized") || combined.includes("401") || combined.includes("invalid_grant")) {
        return { ok: false, status: 401, error: errMsg, code: "GOOGLE_AUTH_ERROR" };
      }
      if (combined.includes("invalid") || combined.includes("400") || combined.includes("bad request")) {
        return { ok: false, status: 422, error: errMsg, code: "GOOGLE_API_ERROR" };
      }

      return {
        ok: false,
        status: 500,
        error: errMsg,
        code: "TOOL_ERROR",
      };
    }

    // Success — extract content from MCP result
    const result = callResponse.result as any;
    return {
      ok: true,
      content: result?.content ?? result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("timed out")) {
      return { ok: false, status: 500, error: message, code: "TIMEOUT" };
    }
    if (message.includes("stdout closed")) {
      return { ok: false, status: 500, error: "Binary crashed during execution", code: "BINARY_CRASH" };
    }

    return { ok: false, status: 500, error: message, code: "SPAWN_ERROR" };
  } finally {
    ac.abort();

    // Kill process
    if (proc) {
      try {
        proc.kill("SIGTERM");
        // Give 2s for graceful shutdown, then SIGKILL
        const exited = await Promise.race([
          proc.exited,
          new Promise<null>((r) => setTimeout(() => r(null), 2000)),
        ]);
        if (exited === null) {
          proc.kill("SIGKILL");
        }
      } catch {
        // Already dead — fine
      }
    }

    // Delete temp files
    try { unlinkSync(saPath); } catch {}
    try { unlinkSync(tomlPath); } catch {}
  }
}

/**
 * Drain stderr in background to prevent pipe blocking.
 */
async function drainStderr(proc: Subprocess): Promise<void> {
  if (!proc.stderr) return;
  const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch {
    // Stream closed
  }
}
