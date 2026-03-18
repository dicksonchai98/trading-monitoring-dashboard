import { create } from "zustand";
import type { EntitlementState, SessionState, UserRole } from "@/lib/types/auth";

interface AuthStore extends SessionState {
  setResolved: (resolved: boolean) => void;
  setSession: (token: string, role: UserRole, entitlement: EntitlementState) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  role: "visitor",
  entitlement: "none",
  resolved: true,
  setResolved: (resolved) => set({ resolved }),
  setSession: (token, role, entitlement) => set({ token, role, entitlement, resolved: true }),
  clearSession: () => set({ token: null, role: "visitor", entitlement: "none", resolved: true }),
}));
