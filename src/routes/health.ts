import { Hono } from "hono";
import { binaryPool } from "../mcp/binary";
import { sessionManager } from "../mcp/session";
import { VERSION } from "../config";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: VERSION,
    uptime: process.uptime(),
    activeSessions: sessionManager.size,
    activeBinaries: binaryPool.size,
  });
});
