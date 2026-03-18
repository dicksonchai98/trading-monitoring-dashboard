import { getJson, postJson } from "@/lib/api/client";
import type {
  BillingCheckoutResponse,
  BillingPlansResponse,
  BillingStatusResponse,
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
