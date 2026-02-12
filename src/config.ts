// Environment configuration

export const config = {
  port: parseInt(process.env.PORT || "3456"),
  host: process.env.HOST || "0.0.0.0",
  databasePath: process.env.DATABASE_PATH || "./data/seo-mcp-saas.db",
  seoMcpBinary: process.env.SEO_MCP_BINARY || "/Users/saura/clawd/projects/seo-mcp/target/release/seo-mcp-server",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",

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
