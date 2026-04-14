import { toast } from "sonner";
import { decodeAccessToken, mapTokenRole } from "@/features/auth/lib/token";
import { getBillingStatus } from "@/features/subscription/api/billing";
import { mapEntitlement, resolveEntitlementFromBillingStatus } from "@/features/subscription/lib/entitlement";

export function getRedirectTarget(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state && typeof state.from === "string") {
    return state.from;
  }
  return "/dashboard";
}

export function formatAuthError(message: string | undefined): string | null {
  switch (message) {
    case "invalid_credentials":
      return "Invalid credentials.";
    case "user_exists":
      return "This email is already registered.";
    case "verification_required":
      return "Please verify your email before registering.";
    case "invalid_email":
      return "Please provide a valid email address.";
    case "invalid_user_id":
      return "User ID format is invalid.";
    case "invalid_password":
      return "Password must be at least 8 characters and include uppercase, lowercase, and number.";
    case "invalid_otp":
      return "Invalid verification code.";
    case "expired":
      return "Verification code expired. Please request a new one.";
    case "cooldown":
    case "rate_limited":
      return "Verification email sent too frequently. Please try again shortly.";
    case "locked":
      return "Too many failed attempts. Please request a new verification code.";
    case "auth_request_failed":
    case "api_request_failed":
      return "Authentication request failed.";
    case "invalid_access_token":
    case "unsupported_role":
      return "Received an invalid session token from the server.";
    default:
      return message ? "Unable to complete authentication." : null;
  }
}

export async function applyAuthenticatedSession(params: {
  token: string;
  source: "login" | "register";
  setSession: (token: string, role: "admin" | "member" | "visitor", entitlement: "none" | "pending" | "active") => void;
}): Promise<void> {
  const payload = decodeAccessToken(params.token);
  const nextRole = mapTokenRole(payload.role);
  let nextEntitlement = mapEntitlement("none");
  try {
    const status = await getBillingStatus(params.token);
    nextEntitlement = resolveEntitlementFromBillingStatus(status);
  } catch {
    nextEntitlement = mapEntitlement("none");
  }
  params.setSession(params.token, nextRole, nextEntitlement);
  toast.success(params.source === "register" ? "Registration successful." : "Login successful.");
}
