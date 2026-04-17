import { toast } from "sonner";
import { decodeAccessToken, mapTokenRole } from "@/features/auth/lib/token";
import { getBillingStatus } from "@/features/subscription/api/billing";
import { mapEntitlement, resolveEntitlementFromBillingStatus } from "@/features/subscription/lib/entitlement";

type TFn = (key: string, variables?: Record<string, string | number>) => string;

export function getRedirectTarget(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state && typeof state.from === "string") {
    return state.from;
  }
  return "/dashboard";
}

export function formatAuthError(t: TFn, message?: string): string | null {
  switch (message) {
    case "invalid_credentials":
      return t("auth.error.invalid_credentials");
    case "user_exists":
      return t("auth.error.user_exists");
    case "verification_required":
      return t("auth.error.verification_required");
    case "invalid_email":
      return t("auth.error.invalid_email");
    case "invalid_user_id":
      return t("auth.error.invalid_user_id");
    case "invalid_password":
      return t("auth.error.invalid_password");
    case "invalid_otp":
      return t("auth.error.invalid_otp");
    case "expired":
      return t("auth.error.expired");
    case "cooldown":
    case "rate_limited":
      return t("auth.error.cooldown");
    case "locked":
      return t("auth.error.locked");
    case "auth_request_failed":
    case "api_request_failed":
      return t("auth.error.auth_request_failed");
    case "invalid_access_token":
    case "unsupported_role":
      return t("auth.error.invalid_access_token");
    default:
      return message ? t("auth.error.generic") : null;
  }
}

export async function applyAuthenticatedSession(params: {
  token: string;
  source: "login" | "register";
  setSession: (token: string, role: "admin" | "member" | "visitor", entitlement: "none" | "pending" | "active") => void;
  t?: TFn;
}): Promise<void> {
  const { token, source, setSession, t } = params;
  const payload = decodeAccessToken(token);
  const nextRole = mapTokenRole(payload.role);
  let nextEntitlement = mapEntitlement("none");
  try {
    const status = await getBillingStatus(token);
    nextEntitlement = resolveEntitlementFromBillingStatus(status);
  } catch {
    nextEntitlement = mapEntitlement("none");
  }
  setSession(token, nextRole, nextEntitlement);
  const translate = t ?? ((k: string) => k);
  toast.success(source === "register" ? translate("auth.success.registration") : translate("auth.success.login"));
}
