import { randomBytes } from "crypto";
import type { BinaryInstance } from "./binary";
import type { AuthContext } from "../types";

export interface McpSession {
  id: string;
  auth: AuthContext;
  binary: BinaryInstance;
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * Manages MCP sessions (maps session IDs to binary instances).
 */
export class SessionManager {
  private sessions = new Map<string, McpSession>();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new session.
   */
  create(auth: AuthContext, binary: BinaryInstance): string {
    const sessionId = randomBytes(32).toString("hex");
    const now = Date.now();

    this.sessions.set(sessionId, {
      id: sessionId,
      auth,
      binary,
      createdAt: now,
      lastAccessedAt: now,
    });

    return sessionId;
  }

  /**
   * Get a session by ID. Returns null if not found or expired.
   */
  get(sessionId: string): McpSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiry
    if (Date.now() - session.lastAccessedAt > this.sessionTimeout) {
      this.destroy(sessionId);
      return null;
    }

    session.lastAccessedAt = Date.now();
    return session;
  }

  /**
   * Destroy a session.
   */
  destroy(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.binary.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Clean up expired sessions.
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessedAt > this.sessionTimeout) {
        this.destroy(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  get size(): number {
    return this.sessions.size;
  }
}

// Global session manager
export const sessionManager = new SessionManager();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  sessionManager.cleanup();
}, 5 * 60 * 1000);
