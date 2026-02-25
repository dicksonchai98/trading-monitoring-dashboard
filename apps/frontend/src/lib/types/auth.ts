export type UserRole = "visitor" | "member" | "admin";
export type EntitlementState = "none" | "pending" | "active";

export interface SessionState {
  token: string | null;
  role: UserRole;
  entitlement: EntitlementState;
  resolved: boolean;
}
