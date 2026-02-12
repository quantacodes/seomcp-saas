import { Hono } from "hono";
import { binaryPool } from "../mcp/binary";
import { sessionManager } from "../mcp/session";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.1.0",
    uptime: process.uptime(),
    activeSessions: sessionManager.size,
    activeBinaries: binaryPool.size,
  });
});
