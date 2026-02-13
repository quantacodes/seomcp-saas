import { Hono } from "hono";
import { cors } from "hono/cors";
// import { logger } from "hono/logger"; // Replaced with structured logger
import { bodyLimit } from "hono/body-limit";
import { config } from "./config";
import { runMigrations } from "./db/migrate";
import { mcpRoutes } from "./routes/mcp";
import { authRoutes } from "./routes/auth";
import { keysRoutes } from "./routes/keys";
import { usageRoutes } from "./routes/usage";
import { healthRoutes } from "./routes/health";
import { googleAuthRoutes } from "./routes/google-auth";
import { landingRoutes } from "./routes/landing";
import { dashboardRoutes } from "./routes/dashboard";
import { billingRoutes } from "./routes/billing";
import { docsRoutes } from "./routes/docs";
import { adminRoutes } from "./routes/admin";
import { openapiRoutes } from "./routes/openapi";
import { toolsRoutes } from "./routes/tools";
import { playgroundRoutes, stopDemoCleanup } from "./routes/playground";
import { legalRoutes } from "./routes/legal";
import { changelogRoutes } from "./routes/changelog";
import { auditRoutes } from "./routes/audits";
import { webhookSettingsRoutes } from "./routes/webhook-settings";
import { scheduleRoutes } from "./routes/schedules";
import { verifyRoutes } from "./routes/verify";
import { binaryPool } from "./mcp/binary";
import { stopIpRateLimitCleanup } from "./middleware/rate-limit-ip";
import { startScheduler, stopScheduler } from "./scheduler/engine";

// Run database migrations
runMigrations();

const app = new Hono();

// Global middleware
app.use("*", bodyLimit({ maxSize: 1024 * 1024 })); // 1MB max request body

app.use("*", cors({
  origin: ["https://seomcp.dev", "https://www.seomcp.dev", "http://localhost:3000", "http://localhost:3456"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Accept", "Mcp-Session-Id"],
  exposeHeaders: ["Mcp-Session-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Used", "X-Request-Id"],
}));

// Request ID for log correlation
app.use("*", async (c, next) => {
  const reqId = c.req.header("X-Request-Id") || crypto.randomUUID().slice(0, 8);
  c.header("X-Request-Id", reqId);
  await next();
});

// Structured request logger with timing
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(1);
  const status = c.res.status;
  const method = c.req.method;
  const path = c.req.path;
  // Skip noisy health checks in logs
  if (path === "/health") return;
  const reqId = c.res.headers.get("X-Request-Id") || "-";
  console.log(JSON.stringify({
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    msg: "request",
    ts: new Date().toISOString(),
    method,
    path,
    status,
    ms: parseFloat(ms),
    reqId,
  }));
});

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

// Routes
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", keysRoutes);
app.route("/", usageRoutes);
app.route("/", mcpRoutes);
app.route("/", googleAuthRoutes);
app.route("/", dashboardRoutes);
app.route("/", billingRoutes);
app.route("/", docsRoutes);
app.route("/", adminRoutes);
app.route("/", openapiRoutes);
app.route("/", toolsRoutes);
app.route("/", playgroundRoutes);
app.route("/", legalRoutes);
app.route("/", changelogRoutes);
app.route("/", auditRoutes);
app.route("/", webhookSettingsRoutes);
app.route("/", scheduleRoutes);
app.route("/", verifyRoutes);
app.route("/", landingRoutes); // Landing page last — API routes take priority

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found", docs: "https://seomcp.dev/docs" }, 404);
});

// Error handler
app.onError((err, c) => {
  const reqId = c.res.headers.get("X-Request-Id") || "unknown";
  console.error(JSON.stringify({
    level: "error",
    msg: "unhandled_error",
    ts: new Date().toISOString(),
    reqId,
    path: c.req.path,
    method: c.req.method,
    error: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  }));
  return c.json({ error: "Internal server error" }, 500);
});

// Start scheduler (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  startScheduler();
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  stopScheduler();
  stopDemoCleanup();
  stopIpRateLimitCleanup();
  binaryPool.killAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopScheduler();
  stopDemoCleanup();
  stopIpRateLimitCleanup();
  binaryPool.killAll();
  process.exit(0);
});

console.log(`
🦀 SEO MCP SaaS v0.1.0
━━━━━━━━━━━━━━━━━━━━━━━
MCP endpoint: http://${config.host}:${config.port}/mcp
Health:       http://${config.host}:${config.port}/health
Signup:       http://${config.host}:${config.port}/api/auth/signup

Binary: ${config.seoMcpBinary}
Database: ${config.databasePath}
`);

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};
