import { config } from "../config";

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

interface LSCheckoutResponse {
  data: {
    id: string;
    attributes: {
      url: string;
    };
  };
}

interface LSSubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_name: string;
  user_email: string;
  status: string;
  cancelled: boolean;
  pause: { mode: string; resumes_at: string | null } | null;
  trial_ends_at: string | null;
  renews_at: string | null;
  ends_at: string | null;
  urls: {
    update_payment_method: string;
    customer_portal: string;
    customer_portal_update_subscription: string;
  };
  created_at: string;
  updated_at: string;
  test_mode: boolean;
}

interface LSSubscriptionResponse {
  data: {
    id: string;
    type: string;
    attributes: LSSubscriptionAttributes;
  };
}

/**
 * Make an authenticated request to Lemon Squeezy API
 */
async function lsRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const apiKey = config.lemonSqueezy.apiKey;
  if (!apiKey) {
    throw new Error("Lemon Squeezy API key not configured");
  }

  const url = `${LS_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  return res;
}

/**
 * Create a checkout URL for a plan upgrade.
 * Uses Lemon Squeezy Checkouts API with pre-filled email and user_id custom data.
 */
export async function createCheckout(
  plan: "pro" | "agency",
  userEmail: string,
  userId: string,
): Promise<{ url: string; checkoutId: string }> {
  const storeId = config.lemonSqueezy.storeId;
  const variantId = config.lemonSqueezy.variantIds[plan];

  if (!storeId || !variantId) {
    throw new Error(`Billing not configured for plan: ${plan}`);
  }

  const res = await lsRequest("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: userEmail,
            custom: {
              user_id: userId,
            },
          },
          checkout_options: {
            embed: true, // For overlay mode
          },
          product_options: {
            redirect_url: `${config.baseUrl}/dashboard?upgraded=true`,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lemon Squeezy checkout creation failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as LSCheckoutResponse;
  return {
    url: data.data.attributes.url,
    checkoutId: data.data.id,
  };
}

/**
 * Get a subscription from Lemon Squeezy.
 */
export async function getSubscription(
  subscriptionId: string,
): Promise<LSSubscriptionResponse> {
  const res = await lsRequest(`/subscriptions/${subscriptionId}`);

  if (!res.ok) {
    throw new Error(`Failed to get subscription ${subscriptionId}: ${res.status}`);
  }

  return (await res.json()) as LSSubscriptionResponse;
}

/**
 * Cancel a subscription (at period end — doesn't immediately revoke access).
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const res = await lsRequest(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`Failed to cancel subscription ${subscriptionId}: ${res.status}`);
  }
}

/**
 * Resume a cancelled subscription (before the end of the current period).
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
  const res = await lsRequest(`/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "subscriptions",
        id: subscriptionId,
        attributes: {
          cancelled: false,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to resume subscription ${subscriptionId}: ${res.status}`);
  }
}

/**
 * Map Lemon Squeezy variant ID to plan name.
 */
export function variantToPlan(variantId: string | number): "pro" | "agency" | null {
  const vid = String(variantId);
  if (vid === config.lemonSqueezy.variantIds.pro) return "pro";
  if (vid === config.lemonSqueezy.variantIds.agency) return "agency";
  return null;
}

export type { LSSubscriptionAttributes, LSSubscriptionResponse };
