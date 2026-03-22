import type { EntitlementState } from "@/lib/types/auth";

export function mapEntitlement(status: string): EntitlementState {
  if (status === "active") {
    return "active";
  }
  if (status === "pending" || status === "checkout_started") {
    return "pending";
  }
  return "none";
}

interface BillingStatusLike {
  status: string;
  entitlement_active?: boolean;
}

export function resolveEntitlementFromBillingStatus(status: BillingStatusLike): EntitlementState {
  if (typeof status.entitlement_active === "boolean") {
    return status.entitlement_active ? "active" : "none";
  }

  return mapEntitlement(status.status);
}
