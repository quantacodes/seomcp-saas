import { Hono } from "hono";
import { binaryPool } from "../mcp/binary";
import { sessionManager } from "../mcp/session";
import { VERSION } from "../config";
import { sqlite } from "../db/index";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  // Quick DB check
  let dbOk = false;
  try {
    sqlite.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "degraded";
  const statusCode = dbOk ? 200 : 503;

  const mem = process.memoryUsage();

  return c.json({
    status,
    version: VERSION,
    uptime: Math.round(process.uptime()),
    activeSessions: sessionManager.size,
    activeBinaries: binaryPool.size,
    db: dbOk ? "ok" : "error",
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  }, statusCode);
});
