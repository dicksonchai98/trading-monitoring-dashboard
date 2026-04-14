import { getJson, postJson } from "@/lib/api/client";
import type {
  BillingCheckoutResponse,
  BillingPortalResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CheckoutSessionStatusResponse,
} from "@/features/subscription/api/types";

export function getBillingPlans(signal?: AbortSignal): Promise<BillingPlansResponse> {
  return getJson<BillingPlansResponse>("/billing/plans", { signal });
}

export function getBillingStatus(token: string, signal?: AbortSignal): Promise<BillingStatusResponse> {
  return getJson<BillingStatusResponse>("/billing/status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
}

export function startCheckout(token: string, signal?: AbortSignal): Promise<BillingCheckoutResponse> {
  return postJson<BillingCheckoutResponse, Record<string, never>>(
    "/billing/checkout",
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    },
  );
}

export function createPortalSession(token: string, signal?: AbortSignal): Promise<BillingPortalResponse> {
  return postJson<BillingPortalResponse, Record<string, never>>(
    "/billing/portal-session",
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    },
  );
}

export function getCheckoutSessionStatus(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<CheckoutSessionStatusResponse> {
  return getJson<CheckoutSessionStatusResponse>(`/billing/checkout-session/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
}
