import type { JSX } from "react";
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { RealtimeDashboardOverview } from "@/features/dashboard/components/RealtimeDashboardOverview";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardUiStore } from "@/lib/store/dashboard-ui-store";
import { toast } from "sonner";

export function RealtimeDashboardPage(): JSX.Element {
  const t = useT();
  const { resolved, entitlement, role } = useAuthStore();
  const { stickyBannerDismissed, dismissStickyBanner } = useDashboardUiStore();
  const shouldShowBanner =
    role !== "admin" &&
    entitlement !== "active" &&
    !stickyBannerDismissed;

  const visitorToastRef = useRef<string | null>(null);
  const closedToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resolved) return;

    if (role === "visitor" && visitorToastRef.current !== "/dashboard") {
      toast(t("guard.dashboard.visitor"), { icon: "⚠️", duration: 7000 });
      visitorToastRef.current = "/dashboard";
    }

    const now = new Date();
    const hhmm = now.getHours() * 100 + now.getMinutes();
    if ((hhmm < 845 || hhmm > 1345) && closedToastRef.current !== "/dashboard") {
      toast(t("guard.realtime.closed"), { icon: "⚠️", duration: 7000 });
      closedToastRef.current = "/dashboard";
    }
  }, [resolved, role, t]);

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
