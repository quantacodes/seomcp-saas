import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { config } from "./config";
import { runMigrations } from "./db/migrate";
import { mcpRoutes } from "./routes/mcp";
import { authRoutes } from "./routes/auth";
import { keysRoutes } from "./routes/keys";
import { usageRoutes } from "./routes/usage";
import { healthRoutes } from "./routes/health";
import { binaryPool } from "./mcp/binary";

// Run database migrations
runMigrations();

const app = new Hono();

// Global middleware
app.use("*", cors({
  origin: ["https://seomcp.dev", "http://localhost:3000", "http://localhost:3456"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Accept", "Mcp-Session-Id"],
  exposeHeaders: ["Mcp-Session-Id"],
}));

app.use("*", logger());

// Routes
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", keysRoutes);
app.route("/", usageRoutes);
app.route("/", mcpRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found", docs: "https://seomcp.dev/docs" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  binaryPool.killAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
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
