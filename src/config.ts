// Environment configuration

export const VERSION = "0.1.0";

export const config = {
  version: VERSION,
  port: parseInt(process.env.PORT || "3456"),
  host: process.env.HOST || "0.0.0.0",
  databasePath: process.env.DATABASE_PATH || "./data/seo-mcp-saas.db",
  seoMcpBinary: process.env.SEO_MCP_BINARY || "/Users/saura/clawd/projects/seo-mcp/target/release/seo-mcp-server",
  jwtSecret: process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    console.warn("⚠️  WARNING: Using default JWT_SECRET — set JWT_SECRET env var for production");
    return "dev-secret-DO-NOT-USE-IN-PRODUCTION";
  })(),

  // Plan limits (calls per month)
  plans: {
    free: { callsPerMonth: 50, maxSites: 1, maxKeys: 1 },
    pro: { callsPerMonth: 2_000, maxSites: 5, maxKeys: 5 },
    agency: { callsPerMonth: 10_000, maxSites: Infinity, maxKeys: 20 },
    enterprise: { callsPerMonth: Infinity, maxSites: Infinity, maxKeys: Infinity },
  } as Record<string, { callsPerMonth: number; maxSites: number; maxKeys: number }>,

  // Binary management
  binaryIdleTimeoutMs: 5 * 60 * 1000, // 5 minutes
  binaryRequestTimeoutMs: 60 * 1000,   // 60 seconds per tool call
} as const;

export type PlanName = "free" | "pro" | "agency" | "enterprise";
