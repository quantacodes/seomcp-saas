import { spawn, type Subprocess } from "bun";
import { config } from "../config";
import type { JsonRpcMessage, JsonRpcResponse } from "../types";

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages a single seo-mcp binary process.
 * Communicates via stdio JSON-RPC (newline-delimited).
 */
export class BinaryInstance {
  private process: Subprocess | null = null;
  private pending = new Map<string | number, PendingRequest>();
  private buffer = "";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private alive = false;
  private initPromise: Promise<void> | null = null;
  private restartAttempts = 0;
  private lastRestartAt = 0;
  private static MAX_RESTART_ATTEMPTS = 3;
  private static RESTART_COOLDOWN_MS = 30_000; // 30 seconds

  constructor(
    private configPath: string,
    private onIdle?: () => void,
  ) {}

  /**
   * Ensure the binary is running and initialized.
   */
  async ensureReady(): Promise<void> {
    if (this.alive && this.process) {
      this.resetIdleTimer();
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.start();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Start the binary process and perform MCP initialization.
   * Includes restart protection to prevent tight respawn loops.
   */
  private async start(): Promise<void> {
    const now = Date.now();
    
    // Reset attempt counter if cooldown has passed
    if (now - this.lastRestartAt > BinaryInstance.RESTART_COOLDOWN_MS) {
      this.restartAttempts = 0;
    }
    
    if (this.restartAttempts >= BinaryInstance.MAX_RESTART_ATTEMPTS) {
      throw new Error(
        `Binary failed to start ${BinaryInstance.MAX_RESTART_ATTEMPTS} times in ${BinaryInstance.RESTART_COOLDOWN_MS / 1000}s. Giving up.`
      );
    }
    
    this.restartAttempts++;
    this.lastRestartAt = now;

    this.process = spawn({
      cmd: [config.seoMcpBinary],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SEO_MCP_CONFIG: this.configPath,
        RUST_LOG: "warn",
      },
    });

    this.alive = true;

    // Read stdout in background
    this.readStdout();
    this.readStderr();

    // Handle process exit
    this.process.exited.then((code) => {
      this.alive = false;
      // Reject all pending requests
      for (const [id, pending] of this.pending) {
        pending.reject(new Error(`Binary exited with code ${code}`));
        clearTimeout(pending.timer);
      }
      this.pending.clear();
    });

    // Send MCP initialize
    const initResponse = await this.send({
      jsonrpc: "2.0",
      id: "__init__",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "seo-mcp-saas", version: "0.1.0" },
      },
    });

    if (initResponse.error) {
      throw new Error(`MCP init failed: ${initResponse.error.message}`);
    }

    // Send initialized notification
    this.writeMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    this.resetIdleTimer();
  }

  /**
   * Send a JSON-RPC request and wait for response.
   */
  async send(message: JsonRpcMessage & { id: string | number }): Promise<JsonRpcResponse> {
    await this.ensureReady();

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.id);
        reject(new Error(`Request timed out after ${config.binaryRequestTimeoutMs}ms`));
      }, config.binaryRequestTimeoutMs);

      this.pending.set(message.id, { resolve, reject, timer });
      this.writeMessage(message);
    });
  }

  /**
   * Send a notification (no response expected).
   */
  notify(message: JsonRpcMessage): void {
    this.writeMessage(message);
  }

  /**
   * Write a JSON-RPC message to stdin.
   */
  private writeMessage(message: JsonRpcMessage): void {
    if (!this.process?.stdin) {
      throw new Error("Binary not running");
    }
    const line = JSON.stringify(message) + "\n";
    this.process.stdin.write(line);
    this.process.stdin.flush();
  }

  /**
   * Read stdout and parse JSON-RPC responses.
   */
  private async readStdout(): Promise<void> {
    if (!this.process?.stdout) return;

    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this.buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIdx: number;
        while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
          const line = this.buffer.slice(0, newlineIdx).trim();
          this.buffer = this.buffer.slice(newlineIdx + 1);

          if (!line) continue;

          try {
            const msg = JSON.parse(line) as JsonRpcResponse;
            this.handleResponse(msg);
          } catch {
            // Non-JSON output from binary — ignore (might be log)
          }
        }
      }
    } catch {
      // Stream closed
    }
  }

  /**
   * Read stderr for logging.
   */
  private async readStderr(): Promise<void> {
    if (!this.process?.stderr) return;

    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Log stderr but don't crash
        const text = decoder.decode(value, { stream: true });
        if (text.trim()) {
          console.warn(`[binary:stderr] ${text.trim()}`);
        }
      }
    } catch {
      // Stream closed
    }
  }

  /**
   * Handle an incoming JSON-RPC response from the binary.
   */
  private handleResponse(msg: JsonRpcResponse): void {
    if (msg.id === undefined || msg.id === null) return;

    const pending = this.pending.get(msg.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      pending.resolve(msg);
    }
  }

  /**
   * Reset the idle timer.
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.kill();
      this.onIdle?.();
    }, config.binaryIdleTimeoutMs);
  }

  /**
   * Kill the binary process.
   */
  kill(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.alive = false;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Binary killed"));
    }
    this.pending.clear();
  }

  get isAlive(): boolean {
    return this.alive;
  }
}

/**
 * Pool of binary instances, keyed by user ID.
 */
export class BinaryPool {
  private instances = new Map<string, BinaryInstance>();

  /**
   * Get or create a binary instance for a user.
   */
  getInstance(userId: string, configPath: string): BinaryInstance {
    let instance = this.instances.get(userId);
    if (instance && instance.isAlive) {
      return instance;
    }

    // Create new instance
    instance = new BinaryInstance(configPath, () => {
      this.instances.delete(userId);
    });
    this.instances.set(userId, instance);
    return instance;
  }

  /**
   * Kill all instances (for shutdown).
   */
  killAll(): void {
    for (const [, instance] of this.instances) {
      instance.kill();
    }
    this.instances.clear();
  }

  get size(): number {
    return this.instances.size;
  }
}

// Global pool
export const binaryPool = new BinaryPool();
