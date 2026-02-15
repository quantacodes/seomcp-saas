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
import { teamRoutes } from "./routes/teams";
import { passwordResetRoutes } from "./routes/password-reset";
import { proxyRoutes } from "./routes/proxy";
import { agentRoutes } from "./routes/agents";
import { googleUploadRoutes } from "./routes/google-upload";
import { waitlistRoutes } from "./routes/waitlist";
import { binaryPool } from "./mcp/binary";
import { stopIpRateLimitCleanup } from "./middleware/rate-limit-ip";
import { startScheduler, stopScheduler } from "./scheduler/engine";

// Run database migrations
runMigrations();

const app = new Hono();

// Global middleware
app.use("*", bodyLimit({ maxSize: 1024 * 1024 })); // 1MB max request body

app.use("*", cors({
  origin: (origin) => {
    const allowed = [
      "https://seomcp.dev",
      "https://www.seomcp.dev",
      "https://api.seomcp.dev",
      "http://localhost:3000",
      "http://localhost:3456",
      "http://localhost:5173",  // Vite dev server
      "https://pinchy-waitlist.pages.dev",
      "https://pinchyseo.com"
    ];
    // Allow all Cloudflare Pages deployments
    if (origin?.endsWith(".seomcp.pages.dev")) {
      return origin;
    }
    return allowed.includes(origin || "") ? origin : allowed[0];
  },
  credentials: true, // Allow cookies for Clerk session
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Accept", "Mcp-Session-Id"],
  exposeHeaders: ["Mcp-Session-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Used", "X-RateLimit-Reset", "X-Request-Id", "X-Min-Version", "X-Force-Update"],
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

// ── Error page HTML (shared by 404 + 500) ──
function errorPageHtml(status: number, title: string, message: string): string {
  const emoji = status === 404 ? "🔍" : "⚠️";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${status} ${title} — seomcp.dev</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body{margin:0;background:#0f172a;color:#f8fafc;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem;}
    .code{font-size:8rem;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#38bdf8,#7dd3fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;}
    h2{font-size:1.25rem;margin:0.5rem 0;color:#e2e8f0;}
    p{color:#64748b;font-size:0.875rem;max-width:28rem;margin:1rem auto;}
    .links{margin-top:1.5rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;}
    a{color:#38bdf8;text-decoration:none;font-size:0.875rem;font-weight:500;}
    a:hover{text-decoration:underline;}
  </style>
</head>
<body>
  <div>
    <div class="code">${status}</div>
    <h2>${emoji} ${title}</h2>
    <p>${message}</p>
    <div class="links">
      <a href="/">Home</a>
      <a href="/docs">Documentation</a>
      <a href="/tools">Tool Catalog</a>
      <a href="/playground">Playground</a>
    </div>
  </div>
</body>
</html>`;
}

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
app.route("/", teamRoutes);
app.route("/", passwordResetRoutes);
app.route("/", proxyRoutes);
app.route("/", agentRoutes);
app.route("/", googleUploadRoutes);
app.route("/", waitlistRoutes);
// Static SEO files
app.get("/robots.txt", (c) => {
  return c.text(`User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /api/\n\nSitemap: https://seomcp.dev/sitemap.xml\n`);
});
app.get("/sitemap.xml", (c) => {
  c.header("Content-Type", "application/xml");
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://seomcp.dev/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>https://seomcp.dev/docs</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n  <url><loc>https://seomcp.dev/tools</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n</urlset>`);
});
app.route("/", landingRoutes); // Landing page last — API routes take priority

// 404 handler — HTML for browsers, JSON for API clients
app.notFound((c) => {
  const accept = c.req.header("Accept") || "";
  if (accept.includes("text/html") && !c.req.path.startsWith("/api/") && !c.req.path.startsWith("/mcp")) {
    return c.html(errorPageHtml(404, "Page Not Found", "The page you're looking for doesn't exist or has been moved."), 404);
  }
  return c.json({ error: "Not found", docs: "https://seomcp.dev/docs" }, 404);
});

// Error handler — HTML for browsers, JSON for API clients
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
  const accept = c.req.header("Accept") || "";
  if (accept.includes("text/html") && !c.req.path.startsWith("/api/") && !c.req.path.startsWith("/mcp")) {
    return c.html(errorPageHtml(500, "Something Went Wrong", "An unexpected error occurred. Please try again."), 500);
  }
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
