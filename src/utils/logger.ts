/**
 * Structured JSON logger for production observability.
 * Falls back to pretty-print in development.
 */

const isProd = process.env.NODE_ENV === "production";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...meta,
  };

  if (isProd) {
    // JSON logs for production (parseable by Loki/Grafana/CloudWatch)
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify(entry));
  } else {
    // Pretty logs for dev
    const prefix = { debug: "🔍", info: "ℹ️", warn: "⚠️", error: "❌" }[level];
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`${prefix} ${msg}${metaStr}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),

  /**
   * Log an API request with timing and user context.
   */
  request(method: string, path: string, meta: {
    status: number;
    durationMs: number;
    userId?: string;
    reqId?: string;
    [key: string]: unknown;
  }) {
    const level = meta.status >= 500 ? "error" : meta.status >= 400 ? "warn" : "info";
    log(level, `${method} ${path} ${meta.status}`, meta);
  },

  /**
   * Log an MCP tool call.
   */
  toolCall(tool: string, meta: {
    userId: string;
    status: "success" | "error" | "rate_limited";
    durationMs: number;
    reqId?: string;
    [key: string]: unknown;
  }) {
    const level = meta.status === "error" ? "warn" : "info";
    log(level, `tool:${tool}`, meta);
  },

  /**
   * Log a billing event.
   */
  billing(event: string, meta: Record<string, unknown>) {
    log("info", `billing:${event}`, meta);
  },
};
