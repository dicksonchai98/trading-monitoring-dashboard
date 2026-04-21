import type { JSX, PropsWithChildren } from "react";
import { useEffect } from "react";
import { refresh } from "@/features/auth/api/auth";
import { decodeAccessToken, mapTokenRole } from "@/features/auth/lib/token";
import { getBillingStatus } from "@/features/subscription/api/billing";
import { isAbortError } from "@/lib/api/client";
import { mapEntitlement, resolveEntitlementFromBillingStatus } from "@/features/subscription/lib/entitlement";
import { useAuthStore } from "@/lib/store/auth-store";

interface SessionBootstrapResult {
  token: string;
  role: ReturnType<typeof mapTokenRole>;
  entitlement: ReturnType<typeof mapEntitlement>;
}

async function resolveSessionBootstrap(signal: AbortSignal): Promise<SessionBootstrapResult | null> {
  const refreshed = await refresh();
  const token = refreshed.access_token;
  const payload = decodeAccessToken(token);

  const role = mapTokenRole(payload.role);
  console.log("Decoded role from token:", payload.role, "Mapped role:", role);

  let entitlement = mapEntitlement("none");
  try {
    const billing = await getBillingStatus(token, signal);
    entitlement = resolveEntitlementFromBillingStatus(billing);
    console.log("[SessionBootstrap] billing status", {
      status: billing.status,
      entitlement_active: billing.entitlement_active,
      entitlement,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    entitlement = mapEntitlement("none");
    console.log("[SessionBootstrap] billing status failed -> fallback none");
  }

  return { token, role, entitlement };
}

export function SessionBootstrap({ children }: PropsWithChildren): JSX.Element {
  const { setResolved, setSession, clearSession } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function bootstrapSession(): Promise<void> {
      console.log("[SessionBootstrap] start");
      setResolved(false);
      try {
        const result = await resolveSessionBootstrap(controller.signal);

        if (!cancelled) {
          if (!result) {
            return;
          }
          const { token, role, entitlement } = result;
          console.log("[SessionBootstrap] setSession", { role, entitlement });
          setSession(token, role, entitlement);
          console.log(
            "[SessionBootstrap] state after setSession",
            useAuthStore.getState(),
          );
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (!cancelled) {
          const current = useAuthStore.getState();
          const hasActiveSession =
            Boolean(current.token) && current.role !== "visitor";
          console.log("[SessionBootstrap] refresh failed", {
            hasActiveSession,
            currentRole: current.role,
            error,
          });
          if (!hasActiveSession) {
            clearSession();
            console.log("[SessionBootstrap] clearSession");
          }
        }
      } finally {
        if (!cancelled) {
          setResolved(true);
          console.log("[SessionBootstrap] resolved");
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [clearSession, setResolved, setSession]);

  return <>{children}</>;
}
