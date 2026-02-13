// Shared types

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// MCP specific
export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

// Auth context added to requests
export interface AuthContext {
  userId: string;
  email: string;
  plan: string;
  apiKeyId: string;
  scopes: string[] | null; // Tool category restrictions, null = unrestricted
  emailVerified: boolean;
}

// SSE event
export interface SseEvent {
  event?: string;
  data: string;
  id?: string;
}
