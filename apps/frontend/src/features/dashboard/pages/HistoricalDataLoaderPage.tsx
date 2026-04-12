import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { BackfillPanel } from "@/features/dashboard/components/BackfillPanel";
import { CrawlerPanel } from "@/features/dashboard/components/CrawlerPanel";
import { UnifiedJobsTable } from "@/features/dashboard/components/UnifiedJobsTable";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { useAuthStore } from "@/lib/store/auth-store";

export function HistoricalDataLoaderPage(): JSX.Element {
  const { token } = useAuthStore();
  const [unifiedJobs, setUnifiedJobs] = useState<UnifiedLoaderJobRecord[]>([]);

  function appendJobs(jobs: UnifiedLoaderJobRecord[]): void {
    if (jobs.length === 0) {
      return;
    }
    setUnifiedJobs((current) => [...jobs, ...current]);
  }

  return (
    <PageLayout
      title="Historical Data Loader"
      actions={<Badge variant="success">Dual Job Runner</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title="LOAD CONFIGURATION">
        <BackfillPanel token={token} onJobsCreated={appendJobs} />
        <CrawlerPanel token={token} onJobsCreated={appendJobs} />
        <UnifiedJobsTable jobs={unifiedJobs} />
      </BentoGridSection>
    </PageLayout>
  );
}
