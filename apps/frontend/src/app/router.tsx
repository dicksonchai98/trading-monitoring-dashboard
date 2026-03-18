import type { JSX } from "react";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import { GuardedRoute } from "@/lib/guards/GuardedRoute";
import { AppShell } from "@/app/layout/AppShell";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";
import { HistoricalDataAnalysisPage } from "@/features/dashboard/pages/HistoricalDataAnalysisPage";
import { MarketThermometerPage } from "@/features/dashboard/pages/MarketThermometerPage";
import { HistoricalDataLoaderPage } from "@/features/dashboard/pages/HistoricalDataLoaderPage";
import { HistoricalAmplitudeDistributionPage } from "@/features/dashboard/pages/HistoricalAmplitudeDistributionPage";
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
          <GuardedRoute requiredRole="visitor">
            <RealtimeDashboardPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/historical-data-analysis",
        element: (
          <GuardedRoute requiredRole="visitor">
            <HistoricalDataAnalysisPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/market-thermometer",
        element: (
          <GuardedRoute requiredRole="visitor">
            <MarketThermometerPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/historical-data-loader",
        element: (
          <GuardedRoute requiredRole="visitor">
            <HistoricalDataLoaderPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/historical-amplitude-distribution",
        element: (
          <GuardedRoute requiredRole="visitor">
            <HistoricalAmplitudeDistributionPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/subscription",
        element: (
          <GuardedRoute requiredRole="visitor">
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
