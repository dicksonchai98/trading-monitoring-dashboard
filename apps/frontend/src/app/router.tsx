import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { GuardedRoute } from "@/lib/guards/GuardedRoute";
import { AppShell } from "@/app/layout/AppShell";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";
import { SubscriptionPage } from "@/features/subscription/pages/SubscriptionPage";
import { AdminAuditPage } from "@/features/admin/pages/AdminAuditPage";
import { ForbiddenPage } from "@/features/common/pages/ForbiddenPage";
import { NotFoundPage } from "@/features/common/pages/NotFoundPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <AppShell />,
    children: [
      {
        path: "/dashboard",
        element: (
          <GuardedRoute requiredRole="member" requireActiveEntitlement>
            <RealtimeDashboardPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/subscription",
        element: (
          <GuardedRoute requiredRole="member">
            <SubscriptionPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/admin/audit",
        element: (
          <GuardedRoute requiredRole="admin">
            <AdminAuditPage />
          </GuardedRoute>
        ),
      },
    ],
  },
  {
    path: "/forbidden",
    element: <ForbiddenPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export function AppRouter(): JSX.Element {
  return <RouterProvider router={router} />;
}
