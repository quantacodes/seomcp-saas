# Security Policy — seomcp.dev

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Email:** security@quantacodes.com
- **Do not** open a public issue for security vulnerabilities

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security Measures

### Authentication
- API keys are SHA-256 hashed before storage — raw keys are never stored
- Dashboard sessions use HTTP-only, Secure, SameSite=Strict cookies
- Email verification tokens use HMAC-SHA256 with timing-safe comparison
- Password reset tokens are single-use with 1-hour expiry
- Team invite tokens use HMAC-SHA256 with 48-hour expiry

### Data Protection
- Google OAuth tokens encrypted at rest with AES-256-GCM (unique IVs per encryption)
- SQLite in WAL mode with parameterized queries (no SQL injection surface)
- Per-user isolated binary processes (no cross-tenant data leakage)

### Rate Limiting
- IP-based rate limiting on signup (5/hr) and login (10/15min)
- Monthly plan-based rate limiting on API calls
- Proxy-aware IP extraction (Fly-Client-IP, CF-Connecting-IP headers)

### Request Security
- CSRF protection via Content-Type enforcement on all mutations
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS
- Request ID correlation on all requests
- 1MB body size limit

### Playground Safety
- SSRF protection: blocks private IPs (10.x, 192.168.x, 172.16-31.x), IPv6 loopback, link-local, cloud metadata endpoints
- Separate rate limiting (5 calls/hr per IP)
- Demo binary isolated from authenticated user binaries

### Admin
- Admin API uses timing-safe secret comparison
- No password hashes or sensitive data in admin responses
- Explicit column selection (no `SELECT *`)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | ✅        |
| < 0.3   | ❌        |

## Dependencies

We keep dependencies minimal. The core stack:
- Bun runtime
- Hono web framework
- better-sqlite3 (via Bun's built-in)
- seo-mcp Rust binary (compiled, no runtime deps)
