// Environment configuration

export const VERSION = "0.1.0";

// Generate a dev-only default for secrets that throws in production
function devSecret(name: string, length: number): string {
  if (process.env[name]) {
    return process.env[name]!;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production`);
  }
  console.warn(`⚠️  WARNING: Using default ${name} — set ${name} env var for production`);
  return "0".repeat(length);
}

export const config = {
  version: VERSION,
  port: parseInt(process.env.PORT || "3456"),
  host: process.env.HOST || "0.0.0.0",
  databasePath: process.env.DATABASE_PATH || "./data/seo-mcp-saas.db",
  seoMcpBinary: process.env.SEO_MCP_BINARY || (process.env.NODE_ENV === "production" ? "/opt/seomcp/seo-mcp-server" : "/Users/saura/clawd/projects/seo-mcp/target/release/seo-mcp-server"),
  jwtSecret: devSecret("JWT_SECRET", 32),

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3456/api/auth/google/callback",

  // Token encryption (32 bytes = 64 hex chars)
  tokenEncryptionKey: devSecret("TOKEN_ENCRYPTION_KEY", 64),

  // Base URL for redirects
  baseUrl: process.env.BASE_URL || "http://localhost:3456",

  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "verify@seomcp.dev",

  // Plan limits (calls per month)
  plans: {
    free: { callsPerMonth: 100, maxSites: 1, maxKeys: 1, maxSchedules: 0 },
    pro: { callsPerMonth: 2_000, maxSites: 5, maxKeys: 5, maxSchedules: 3 },
    agency: { callsPerMonth: 10_000, maxSites: Infinity, maxKeys: 20, maxSchedules: 20 },
    enterprise: { callsPerMonth: Infinity, maxSites: Infinity, maxKeys: Infinity, maxSchedules: Infinity },
  } as Record<string, { callsPerMonth: number; maxSites: number; maxKeys: number; maxSchedules: number }>,

  // Lemon Squeezy billing — use getters so env can be set per-test
  get lemonSqueezy() {
    return {
      apiKey: process.env.LEMONSQUEEZY_API_KEY || "",
      storeId: process.env.LEMONSQUEEZY_STORE_ID || "",
      webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "",
      variantIds: {
        pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID || "",
        agency: process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || "",
      },
    };
  },

  // Binary management
  binaryIdleTimeoutMs: 5 * 60 * 1000, // 5 minutes
  binaryRequestTimeoutMs: 60 * 1000,   // 60 seconds per tool call

  // Proxy API (Phase 2)
  maxProxyConcurrentSpawns: parseInt(process.env.MAX_PROXY_CONCURRENT_SPAWNS || "15"),
  proxyTimeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS || "30000"),
};

export type PlanName = "free" | "pro" | "agency" | "enterprise";
