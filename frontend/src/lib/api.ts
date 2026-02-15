// API client for seomcp.dev
// Works with Clerk authentication

import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.seomcp.dev';

// Error types for better error handling
export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: string;
  
  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network error. Please check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthError extends Error {
  constructor(message = 'Authentication failed. Please sign in again.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends Error {
  retryAfter?: number;
  
  constructor(
    message = 'Rate limit exceeded. Please try again later.',
    retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Get user-friendly error message
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return error.message || 'You don\'t have permission to do that.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return error.message || 'There was a conflict. Please try again.';
      case 422:
        return error.message || 'Invalid input. Please check your data.';
      case 429:
        return error.message || 'Too many requests. Please slow down.';
      case 500:
        return 'Something went wrong on our end. Please try again.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
  
  if (error instanceof NetworkError) {
    return error.message;
  }
  
  if (error instanceof AuthError) {
    return error.message;
  }
  
  if (error instanceof RateLimitError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred.';
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'agency' | 'enterprise';
  emailVerified: boolean;
}

export interface UsageStats {
  used: number;
  limit: number | 'unlimited';
  remaining: number | 'unlimited';
  plan: string;
}

// Backend response shape
interface OverviewResponse {
  user: User;
  usage: UsageStats & {
    period: string;
    breakdown: { success: number; error: number; rateLimited: number };
    avgDurationMs: number;
    topTools: { tool: string; count: number }[];
    dailyUsage: { date: string; calls: number }[];
  };
  keys: ApiKey[];
  google: { connected: boolean; email?: string; scopes?: string; connectedAt?: string };
  recentCalls: { tool: string; status: string; durationMs: number; createdAt: string }[];
  billing: { plan: string; status: string; renewsAt: string; cancelAtPeriodEnd: boolean; portalUrl: string } | null;
}

// Create API client with auth hook
export function useApiClient() {
  const { getToken } = useAuth();

  async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;
    
    let token: string | null;
    try {
      token = await getToken();
    } catch {
      throw new AuthError('Failed to get authentication token.');
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      // Network error (fetch threw)
      throw new NetworkError();
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      
      // Handle specific status codes
      switch (response.status) {
        case 401:
          throw new AuthError(errorMessage);
        case 429: {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            errorMessage,
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
        }
        default:
          throw new ApiError(errorMessage, response.status, errorData.code, errorData.details);
      }
    }
    
    return response.json();
  }

  return {
    // User API
    getUser: (): Promise<User> =>
      fetchApi('/api/user/me'),

    // API Keys
    listKeys: (): Promise<ApiKey[]> =>
      fetchApi('/dashboard/api/keys'),
    
    createKey: (name: string): Promise<{ id: string; key: string; prefix: string; name: string; message: string }> =>
      fetchApi('/dashboard/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    
    revokeKey: (id: string): Promise<void> =>
      fetchApi(`/dashboard/api/keys/${id}/revoke`, { method: 'POST' }),

    // Usage (extract from overview)
    getStats: async (): Promise<UsageStats> => {
      const data = await fetchApi('/dashboard/api/overview') as OverviewResponse;
      return data.usage;
    },

    // Billing
    getCheckoutUrl: (plan: 'pro' | 'agency'): Promise<{ url: string }> =>
      fetchApi('/dashboard/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }),
    
    getPortalUrl: (): Promise<{ url: string }> =>
      fetchApi('/dashboard/api/billing/portal'),
  };
}

// Legacy exports for backwards compatibility (will be removed)
export const userApi = {
  me: (): Promise<User> =>
    fetch(`${API_URL}/api/user/me`).then(r => r.json()),
};

export const keysApi = {
  list: (): Promise<ApiKey[]> =>
    fetch(`${API_URL}/dashboard/api/keys`).then(r => r.json()),
  
  create: (name: string): Promise<{ key: ApiKey; rawKey: string }> =>
    fetch(`${API_URL}/dashboard/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => r.json()),
  
  revoke: (id: string): Promise<void> =>
    fetch(`${API_URL}/dashboard/api/keys/${id}/revoke`, { method: 'POST' }).then(() => {}),
};

export const usageApi = {
  getStats: async (): Promise<UsageStats> => {
    const r = await fetch(`${API_URL}/dashboard/api/overview`);
    const data = await r.json();
    return data.usage;
  },
};

export const billingApi = {
  getCheckoutUrl: (plan: 'pro' | 'agency'): Promise<{ url: string }> =>
    fetch(`${API_URL}/dashboard/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    }).then(r => r.json()),
  
  getPortalUrl: (): Promise<{ url: string }> =>
    fetch(`${API_URL}/dashboard/api/billing/portal`).then(r => r.json()),
};
