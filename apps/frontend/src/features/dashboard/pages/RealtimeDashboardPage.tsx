import type { JSX } from "react";
import { Link } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { RealtimeDashboardOverview } from "@/features/dashboard/components/RealtimeDashboardOverview";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardUiStore } from "@/lib/store/dashboard-ui-store";

export function RealtimeDashboardPage(): JSX.Element {
  const t = useT();
  const { resolved, entitlement, role } = useAuthStore();
  const { stickyBannerDismissed, dismissStickyBanner } = useDashboardUiStore();
  const shouldShowBanner =
    role !== "admin" &&
    entitlement !== "active" &&
    !stickyBannerDismissed;

  if (!resolved) {
    return <PageSkeleton />;
  }
  return (
    <>
      {shouldShowBanner ? (
        <StickyBanner
          className="!fixed top-0 z-50 bg-gradient-to-r from-emerald-600 to-teal-600"
          onClose={dismissStickyBanner}
          closeLabel={t("dashboard.realtime.stickyBanner.close")}
        >
          <p className="mx-0 max-w-[90%] text-white">
            {t("dashboard.realtime.stickyBanner.message")}{" "}
            <Link to="/subscription" className="underline underline-offset-4">
              {t("dashboard.realtime.stickyBanner.cta")}
            </Link>
          </p>
        </StickyBanner>
      ) : null}
      <RealtimeDashboardOverview />
    </>
  );
}
