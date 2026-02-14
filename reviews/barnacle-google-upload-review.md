# Barnacle 🪸 Google Service Account Upload Code Review

**Review Date:** 2026-02-14  
**Reviewer:** Barnacle (Code Review)  
**Subject:** Google Service Account Upload Implementation (Commit cf8a511)  
**Files Reviewed:** google-upload.ts, schema.ts, migrate.ts, index.ts

## 🚨 VERDICT: REQUEST CHANGES

Critical security and correctness issues found that must be addressed before merge.

## 📋 Critical Issues (Fix Required)

### 1. **🔥 SECURITY: Private Key Exposure Risk**
**Location:** `google-upload.ts:313-320`

**Issue:** Error handling may leak private key in logs
```typescript
} catch (error) {
  console.error("Error storing service account:", error); // ⚠️ Could log entire serviceAccount object
  return c.json({ error: "Failed to store service account" }, 500);
}
```

**Impact:** If encryption fails, the full service account JSON (including private key) could be written to application logs.

**Fix:**
```typescript
} catch (error) {
  console.error("Error storing service account:", { 
    userId: session.userId, 
    email: sa.client_email,
    error: error instanceof Error ? error.message : String(error)
  });
  return c.json({ error: "Failed to store service account" }, 500);
}
```

### 2. **🔥 SECURITY: Missing Rate Limiting**
**Location:** All endpoints

**Issue:** No rate limiting on credential operations enables:
- Brute force validation attempts
- DoS via repeated encryption operations
- Credential enumeration attacks

**Fix:** Add rate limiting middleware:
```typescript
// Add before each endpoint
const rateLimitResult = await checkRateLimit(session.userId, 'google_creds', 10); // 10/hour
if (!rateLimitResult.allowed) {
  return c.json({ error: "Rate limit exceeded" }, 429);
}
```

### 3. **🔥 CORRECTNESS: Race Condition in Upsert**
**Location:** `google-upload.ts:279-310`

**Issue:** Non-atomic upsert operation:
```typescript
const existingCred = db.select()... // Read
// ... time gap ...
if (existingCred) {
  db.update()... // Write
} else {
  db.insert()... // Write  
}
```

**Impact:** Concurrent uploads could create duplicate credentials or lost updates.

**Fix:** Use proper UPSERT with ON CONFLICT:
```typescript
db.insert(schema.googleCredentials)
  .values({...})
  .onConflictDoUpdate({
    target: [schema.googleCredentials.userId, schema.googleCredentials.credentialType],
    set: { encryptedData, email: sa.client_email, updatedAt: now }
  })
  .run();
```

### 4. **🔥 SECURITY: Missing Input Sanitization**
**Location:** Multiple validation checks

**Issue:** Several fields not sanitized before database storage:
- `sa.client_email` - could contain SQL injection attempts
- `sa.project_id` - not validated for reasonable length/format
- Error messages from Google API directly returned to client

**Fix:**
```typescript
// Sanitize email
const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.iam\.gserviceaccount\.com$/;
if (!emailRegex.test(sa.client_email)) {
  return c.json({ error: "Invalid service account email format" }, 400);
}

// Sanitize project_id  
if (!/^[a-z][a-z0-9\-]{4,28}[a-z0-9]$/.test(sa.project_id)) {
  return c.json({ error: "Invalid project_id format" }, 400);
}
```

### 5. **🔥 CORRECTNESS: JWT Algorithm Mismatch**
**Location:** `google-upload.ts:30-44`

**Issue:** Using `RSA-SHA256` signing but header specifies `RS256`:
```typescript
const header = { alg: "RS256", typ: "JWT" }; // RS256
// ...
const sign = createSign("RSA-SHA256"); // Different algorithm name
```

**Impact:** While functionally equivalent, this inconsistency could cause issues with strict JWT validators.

**Fix:**
```typescript
const sign = createSign("sha256"); // Standard Node.js identifier for RS256
```

## ⚠️ High Priority Issues

### 6. **Missing CSRF Protection**
**Location:** All POST endpoints

**Issue:** `requireJson()` function only checks Content-Type, doesn't provide CSRF protection.

**Impact:** Authenticated users could be tricked into uploading credentials via malicious sites.

**Fix:** Add CSRF token validation or use SameSite cookies with origin checking:
```typescript
function requireSafeRequest(c: any): Response | null {
  const origin = c.req.header("Origin");
  const allowedOrigins = ["https://seomcp.dev", "https://www.seomcp.dev"];
  
  if (origin && !allowedOrigins.includes(origin)) {
    return c.json({ error: "Invalid origin" }, 403);
  }
  
  return requireJson(c);
}
```

### 7. **Insufficient Error Message Sanitization**
**Location:** `google-upload.ts:357-378`

**Issue:** Google API errors passed through unsanitized:
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Validation failed";
  // ... stored and returned to client
  return c.json({ 
    valid: false, 
    error: errorMessage  // ⚠️ Could expose internal details
  });
}
```

**Fix:**
```typescript
const sanitizedError = error instanceof Error 
  ? error.message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // Remove IPs
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // Remove emails
    .slice(0, 200) // Truncate
  : "Authentication failed";
```

### 8. **Missing Database Transaction**
**Location:** Upsert operation

**Issue:** Multiple database operations not wrapped in transaction.

**Fix:**
```typescript
db.transaction(() => {
  // All DB operations here
});
```

### 9. **Weak Private Key Validation**
**Location:** `google-upload.ts:127-129`

**Issue:** Only checks prefix, not actual key validity:
```typescript
if (!sa.private_key.startsWith("-----BEGIN PRIVATE KEY-----")) {
  return c.json({ error: "Invalid service account: private_key must start with '-----BEGIN PRIVATE KEY-----'" }, 400);
}
```

**Fix:** Validate full PEM format:
```typescript
const privateKeyRegex = /^-----BEGIN PRIVATE KEY-----\s*([A-Za-z0-9+\/\s]+=*)\s*-----END PRIVATE KEY-----$/;
if (!privateKeyRegex.test(sa.private_key.trim())) {
  return c.json({ error: "Invalid private key format" }, 400);
}
```

## 📋 Medium Priority Issues

### 10. **Missing Index on Composite Key**
**Location:** `migrate.ts:194`

**Issue:** Only single-column index on `user_id`, but queries filter on `user_id + credential_type`.

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS idx_google_creds_user_type ON google_credentials(user_id, credential_type);
```

### 11. **Session Validation Inconsistency** 
**Location:** `google-upload.ts:11-23`

**Issue:** `getSessionHybrid()` silently falls through on Clerk errors, making debugging difficult.

**Fix:** Log authentication attempts for audit trail:
```typescript
console.log(`Auth attempt: ${c.req.path} - Clerk: ${clerkSession ? 'success' : 'failed'}, Cookie: ${sessionId ? 'present' : 'missing'}`);
```

### 12. **Hardcoded Timeout Values**
**Location:** `google-upload.ts:49, 60`

**Issue:** 10-second timeouts hardcoded in multiple places.

**Fix:** Extract to configuration:
```typescript
const GOOGLE_API_TIMEOUT = config.googleApiTimeout || 10_000;
```

## ✅ Security Positives

**Good practices observed:**

1. ✅ **Encryption at rest** using existing `encryptToken()` function
2. ✅ **Ownership verification** on all credential operations  
3. ✅ **Content-Type validation** on mutating endpoints
4. ✅ **Comprehensive field validation** for service account JSON
5. ✅ **Size limits** (10KB) prevent DoS
6. ✅ **URI validation** prevents redirect attacks
7. ✅ **Never returns encrypted data** in list endpoint
8. ✅ **Proper HTTP status codes** throughout
9. ✅ **AbortSignal timeouts** for external API calls

## 📊 Code Quality Assessment

| Aspect | Score | Notes |
|--------|-------|-------|
| Security | 6/10 | Good encryption, missing rate limiting & CSRF |  
| Correctness | 7/10 | JWT works, but race conditions exist |
| Error Handling | 5/10 | Basic coverage, potential information leakage |
| Database Design | 8/10 | Good schema, missing composite index |
| Code Structure | 8/10 | Clean, readable, follows patterns |
| Testing Coverage | 0/10 | No tests found |

## 🔧 Required Changes Before Merge

**Security (Must Fix):**
1. Fix private key logging exposure risk
2. Add rate limiting on all endpoints  
3. Fix race condition with proper UPSERT
4. Add input sanitization for all fields
5. Add CSRF protection

**Correctness (Must Fix):**
1. Use atomic database operations
2. Fix JWT algorithm consistency
3. Add composite database index

**Testing (Strongly Recommended):**
1. Add unit tests for validation logic
2. Add integration tests for full flow
3. Add security tests (SQL injection, XSS attempts)

## 💯 Recommendation

**REQUEST CHANGES** - The implementation has good architectural foundations but contains several critical security vulnerabilities that must be addressed. The functionality is solid, but production deployment would be unsafe without the security fixes outlined above.

**Estimated Fix Time:** 6-8 hours  
**Risk Level After Fixes:** Low  
**Complexity:** Medium

---
*Review by Barnacle 🪸 — Code Review & Security*  
*"Security is not a feature, it's a foundation"*