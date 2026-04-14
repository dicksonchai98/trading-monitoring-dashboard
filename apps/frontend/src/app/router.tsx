import type { JSX } from "react";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import { GuardedRoute } from "@/lib/guards/GuardedRoute";
import { AppShell } from "@/app/layout/AppShell";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { SignupPage } from "@/features/auth/pages/SignupPage";
import { SignupEmailVerificationPage } from "@/features/auth/pages/SignupEmailVerificationPage";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";
import { HistoricalDataAnalysisPage } from "@/features/dashboard/pages/HistoricalDataAnalysisPage";
import { MarketThermometerPage } from "@/features/dashboard/pages/MarketThermometerPage";
import { HistoricalDataLoaderPage } from "@/features/dashboard/pages/HistoricalDataLoaderPage";
import { HistoricalAmplitudeDistributionPage } from "@/features/dashboard/pages/HistoricalAmplitudeDistributionPage";
import { TreemapDemoPage } from "@/features/dashboard/pages/TreemapDemoPage";
import { EventAnalyticsPage } from "@/features/analytics/pages/EventAnalyticsPage";
import { DistributionAnalyticsPage } from "@/features/analytics/pages/DistributionAnalyticsPage";
import { SubscriptionPage } from "@/features/subscription/pages/SubscriptionPage";
import {
  CheckoutCancelPage,
  CheckoutSuccessPage,
} from "@/features/subscription/pages/CheckoutResultPage";
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
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/signup/verify-email",
    element: <SignupEmailVerificationPage />,
  },
  {
    path: "/subscription/checkout/success",
    element: <CheckoutSuccessPage />,
  },
  {
    path: "/subscription/checkout/cancel",
    element: <CheckoutCancelPage />,
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
          <GuardedRoute requiredRole="member" requireActiveEntitlement>
            <HistoricalDataAnalysisPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/market-thermometer",
        element: (
          <GuardedRoute requiredRole="member" requireActiveEntitlement>
            <MarketThermometerPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/historical-data-loader",
        element: (
          <GuardedRoute requiredRole="admin">
            <HistoricalDataLoaderPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/historical-amplitude-distribution",
        element: (
          <GuardedRoute requiredRole="member" requireActiveEntitlement>
            <HistoricalAmplitudeDistributionPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/treemap-demo",
        element: (
          <GuardedRoute requiredRole="member" requireActiveEntitlement>
            <TreemapDemoPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/analytics/events",
        element: (
          <GuardedRoute requiredRole="member">
            <EventAnalyticsPage />
          </GuardedRoute>
        ),
      },
      {
        path: "/analytics/distributions",
        element: (
          <GuardedRoute requiredRole="member">
            <DistributionAnalyticsPage />
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
