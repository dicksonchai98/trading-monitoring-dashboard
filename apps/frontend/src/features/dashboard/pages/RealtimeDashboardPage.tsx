import type { JSX } from "react";
import { Link } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { RealtimeDashboardOverview } from "@/features/dashboard/components/RealtimeDashboardOverview";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardUiStore } from "@/lib/store/dashboard-ui-store";

export function RealtimeDashboardPage(): JSX.Element {
  const { resolved, entitlement } = useAuthStore();
  const { stickyBannerDismissed, dismissStickyBanner } = useDashboardUiStore();
  const shouldShowBanner = entitlement !== "active" && !stickyBannerDismissed;

  if (!resolved) {
    return <PageSkeleton />;
  }
  return (
    <>
      {shouldShowBanner ? (
        <StickyBanner
          className="!fixed top-0 z-50 bg-gradient-to-r from-emerald-600 to-teal-600"
          onClose={dismissStickyBanner}
        >
          <p className="mx-0 max-w-[90%] text-white">
            Unlock Pro insights now - subscribe to Pro.{" "}
            <Link to="/subscription" className="underline underline-offset-4">
              Pricing
            </Link>
          </p>
        </StickyBanner>
      ) : null}
      <RealtimeDashboardOverview />
    </>
  );
}
