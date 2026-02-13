# ── SEO MCP SaaS Dockerfile ──
# Two options for the seo-mcp binary:
# 1. Pre-built: Copy a linux-amd64 binary as ./seo-mcp-server before building
# 2. Multi-stage: Build from source (slower, ~5 min, needs full Rust source)

# ── Option 1: Pre-built binary (FAST — recommended for Fly.io) ──
FROM oven/bun:1.3-debian AS runtime

WORKDIR /app

# Install minimal runtime deps for the Rust binary
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Install JS dependencies
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy source
COPY src/ src/
COPY tsconfig.json ./

# Copy pre-built seo-mcp binary (must be linux-amd64)
# Build with: docker run --rm -v $PWD/../seo-mcp:/src -w /src rust:1.84-bookworm cargo build --release
# Then: cp ../seo-mcp/target/release/seo-mcp-server ./seo-mcp-server
COPY seo-mcp-server /app/seo-mcp-server
RUN chmod +x /app/seo-mcp-server

# Create data directory
RUN mkdir -p /app/data /tmp/seo-mcp-saas

# Environment
ENV NODE_ENV=production
ENV SEO_MCP_BINARY=/app/seo-mcp-server
ENV DATABASE_PATH=/data/seo-mcp-saas.db

# Security: non-root user
RUN groupadd -r seo && useradd -r -g seo -d /app seo
RUN chown -R seo:seo /app /tmp/seo-mcp-saas
USER seo

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3456/health || exit 1

CMD ["bun", "run", "src/index.ts"]
