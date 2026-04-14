import type { JSX, PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useAuthStore } from "@/lib/store/auth-store";
import type { UserRole } from "@/lib/types/auth";

interface GuardedRouteProps extends PropsWithChildren {
  requiredRole: UserRole;
  requireActiveEntitlement?: boolean;
  allowAdminBypassEntitlement?: boolean;
}

const roleRank: Record<UserRole, number> = {
  visitor: 0,
  member: 1,
  admin: 2,
};

export function GuardedRoute({
  requiredRole,
  requireActiveEntitlement = false,
  allowAdminBypassEntitlement = true,
  children,
}: GuardedRouteProps): JSX.Element {
  const location = useLocation();
  const { resolved, role, entitlement } = useAuthStore();

  if (!resolved) {
    return <PageSkeleton />;
  }

  if (roleRank[role] < roleRank[requiredRole]) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (
    requireActiveEntitlement &&
    entitlement !== "active" &&
    !(allowAdminBypassEntitlement && role === "admin")
  ) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}
