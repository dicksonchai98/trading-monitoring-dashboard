import { getJson, postJson } from "@/lib/api/client";
import type {
  BillingCheckoutResponse,
  BillingPortalResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CheckoutSessionStatusResponse,
} from "@/features/subscription/api/types";

export function getBillingPlans(): Promise<BillingPlansResponse> {
  return getJson<BillingPlansResponse>("/billing/plans");
}

export function getBillingStatus(token: string): Promise<BillingStatusResponse> {
  return getJson<BillingStatusResponse>("/billing/status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function startCheckout(token: string): Promise<BillingCheckoutResponse> {
  return postJson<BillingCheckoutResponse, Record<string, never>>(
    "/billing/checkout",
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function createPortalSession(token: string): Promise<BillingPortalResponse> {
  return postJson<BillingPortalResponse, Record<string, never>>(
    "/billing/portal-session",
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function getCheckoutSessionStatus(
  token: string,
  sessionId: string,
): Promise<CheckoutSessionStatusResponse> {
  return getJson<CheckoutSessionStatusResponse>(`/billing/checkout-session/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
