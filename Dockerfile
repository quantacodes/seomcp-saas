FROM oven/bun:1.3-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile

# Copy source
COPY src/ src/
COPY tsconfig.json ./

# Copy seo-mcp binary (must be linux-amd64)
COPY seo-mcp-server /app/seo-mcp-server
RUN chmod +x /app/seo-mcp-server

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV SEO_MCP_BINARY=/app/seo-mcp-server
ENV DATABASE_PATH=/app/data/seo-mcp-saas.db

EXPOSE 3456

CMD ["bun", "run", "src/index.ts"]
