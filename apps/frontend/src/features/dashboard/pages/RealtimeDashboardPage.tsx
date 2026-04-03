import type { JSX } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { RealtimeDashboardOverview } from "@/features/dashboard/components/RealtimeDashboardOverview";
import { useAuthStore } from "@/lib/store/auth-store";

export function RealtimeDashboardPage(): JSX.Element {
  const { resolved } = useAuthStore();
  if (!resolved) {
    return <PageSkeleton />;
  }
  return <RealtimeDashboardOverview />;
}
