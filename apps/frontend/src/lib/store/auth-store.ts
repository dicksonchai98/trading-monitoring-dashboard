import { create } from "zustand";
import type { EntitlementState, SessionState, UserRole } from "@/lib/types/auth";

const CHECKOUT_SESSION_STORAGE_KEY = "billing.checkout_session_id";

function readCheckoutSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY);
}

function writeCheckoutSessionId(sessionId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (sessionId) {
    window.sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, sessionId);
    return;
  }
  window.sessionStorage.removeItem(CHECKOUT_SESSION_STORAGE_KEY);
}

interface AuthStore extends SessionState {
  setResolved: (resolved: boolean) => void;
  setSession: (token: string, role: UserRole, entitlement: EntitlementState) => void;
  setCheckoutSessionId: (sessionId: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  role: "visitor",
  entitlement: "none",
  resolved: false,
  checkoutSessionId: readCheckoutSessionId(),
  setResolved: (resolved) => set({ resolved }),
  setSession: (token, role, entitlement) => set({ token, role, entitlement, resolved: true }),
  setCheckoutSessionId: (sessionId) => {
    writeCheckoutSessionId(sessionId);
    set({ checkoutSessionId: sessionId });
  },
  clearSession: () => {
    writeCheckoutSessionId(null);
    set({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });
  },
}));
