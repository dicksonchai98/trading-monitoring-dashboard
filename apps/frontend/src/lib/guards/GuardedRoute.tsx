import type { JSX, PropsWithChildren } from "react";
import { useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useAuthStore } from "@/lib/store/auth-store";
import type { UserRole } from "@/lib/types/auth";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const loginToastPathRef = useRef<string | null>(null);
  const subscriptionToastPathRef = useRef<string | null>(null);

  if (!resolved) {
    return <PageSkeleton />;
  }

  if (roleRank[role] < roleRank[requiredRole]) {
    if (loginToastPathRef.current !== location.pathname) {
      toast(t("guard.redirect.login"), { icon: "⚠️", duration: 7000 });
      loginToastPathRef.current = location.pathname;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (
    requireActiveEntitlement &&
    entitlement !== "active" &&
    !(allowAdminBypassEntitlement && role === "admin")
  ) {
    if (subscriptionToastPathRef.current !== location.pathname) {
      toast(t("guard.redirect.subscription"), { icon: "⚠️", duration: 7000 });
      subscriptionToastPathRef.current = location.pathname;
    }
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}
