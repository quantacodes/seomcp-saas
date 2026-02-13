/**
 * @seomcp/proxy — HTTPS client for api.seomcp.dev
 *
 * Zero-dependency HTTP client using Node.js built-in https module.
 * Handles tool call forwarding, manifest fetching, and health checks.
 */

import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import { VERSION, checkVersionHeaders } from "./version.js";
import type { ServiceAccountCredentials } from "./credentials.js";

export interface CloudResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface CloudError {
  ok: false;
  kind: "timeout" | "network" | "http";
  status?: number;
  message: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface CloudSuccess {
  ok: true;
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type CloudResult = CloudSuccess | CloudError;

/** Default API base URL */
const DEFAULT_API_URL = "https://api.seomcp.dev";

function getApiUrl(): string {
  return process.env.SEOMCP_API_URL || DEFAULT_API_URL;
}

function getTimeout(): number {
  const t = process.env.SEOMCP_TIMEOUT;
  if (t) {
    const n = parseInt(t, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 30_000;
}

/**
 * Low-level HTTPS request using Node built-ins.
 * Returns a promise with status, headers, and parsed body.
 */
function request(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs?: number,
): Promise<CloudResult> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        ...headers,
        ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}),
      },
    };

    const timeout = timeoutMs ?? getTimeout();

    const req = mod.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        const responseHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === "string") responseHeaders[k] = v;
          else if (Array.isArray(v)) responseHeaders[k] = v[0];
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }

        resolve({
          ok: true,
          status: res.statusCode ?? 0,
          headers: responseHeaders,
          body: parsed,
        });
      });
    });

    req.on("error", (err: Error) => {
      resolve({
        ok: false,
        kind: "network",
        message: err.message,
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({
        ok: false,
        kind: "timeout",
        message: `Request timed out after ${timeout}ms`,
      });
    });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Forward a tool call to the cloud API.
 * Attaches credentials, API key, and proxy version header.
 * NO retries — credentials in body.
 */
export async function callTool(
  apiKey: string,
  toolName: string,
  args: Record<string, unknown>,
  credentials: ServiceAccountCredentials,
  gscProperty?: string,
  ga4Property?: string,
): Promise<CloudResult> {
  const url = `${getApiUrl()}/v1/tools/call`;

  const payload = JSON.stringify({
    tool: toolName,
    arguments: args,
    credentials: {
      google_service_account: credentials,
      ...(gscProperty ? { gsc_property: gscProperty } : {}),
      ...(ga4Property ? { ga4_property: ga4Property } : {}),
    },
  });

  const result = await request(
    "POST",
    url,
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Proxy-Version": VERSION,
    },
    payload,
  );

  // Check version headers on every cloud response
  if (result.ok) {
    checkVersionHeaders(result.headers);
  }

  return result;
}

/**
 * Fetch the tool manifest from the cloud.
 * 3 retries with exponential backoff.
 * Auth optional — endpoint is public.
 */
export async function fetchManifest(
  apiKey?: string,
): Promise<CloudResult> {
  const url = `${getApiUrl()}/v1/tools/manifest`;

  const headers: Record<string, string> = {
    "X-Proxy-Version": VERSION,
    Accept: "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let lastError: CloudResult | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms, 1500ms
      await sleep(500 * Math.pow(3, attempt - 1));
    }

    const result = await request("GET", url, headers, undefined, 10_000);

    if (result.ok && result.status >= 200 && result.status < 300) {
      checkVersionHeaders(result.headers);
      return result;
    }

    lastError = result;
  }

  return lastError ?? {
    ok: false,
    kind: "network",
    message: "Failed to fetch manifest after 3 attempts",
  };
}

/**
 * Health check — ping the cloud API.
 */
export async function healthCheck(apiKey?: string): Promise<CloudResult> {
  const url = `${getApiUrl()}/health`;
  const headers: Record<string, string> = {
    "X-Proxy-Version": VERSION,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return request("GET", url, headers, undefined, 5_000);
}

/**
 * Auth test — validate API key with the cloud.
 */
export async function authTest(apiKey: string): Promise<CloudResult> {
  const url = `${getApiUrl()}/v1/auth/test`;
  return request(
    "GET",
    url,
    {
      Authorization: `Bearer ${apiKey}`,
      "X-Proxy-Version": VERSION,
    },
    undefined,
    5_000,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
