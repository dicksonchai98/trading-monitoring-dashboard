import type { JSX } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/ui/page-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackfillPanel } from "@/features/dashboard/components/BackfillPanel";
import { CrawlerPanel } from "@/features/dashboard/components/CrawlerPanel";
import { UnifiedJobsTable } from "@/features/dashboard/components/UnifiedJobsTable";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";

export function HistoricalDataLoaderPage(): JSX.Element {
  const t = useT();
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
      title={t("dashboard.loader.title")}
      actions={<Badge variant="success">{t("dashboard.loader.badge")}</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <Tabs defaultValue="backfill" className="flex-col space-y-4">
        <TabsList variant="line" className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="backfill"
            className="flex-none rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-active:border-foreground"
          >
            {t("dashboard.loader.backfill.title")}
          </TabsTrigger>
          <TabsTrigger
            value="crawler"
            className="flex-none rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-active:border-foreground"
          >
            {t("dashboard.loader.crawler.title")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backfill" className="space-y-4 pt-2">
          <BackfillPanel token={token} onJobsCreated={appendJobs} />
        </TabsContent>

        <TabsContent value="crawler" className="space-y-4 pt-2">
          <CrawlerPanel token={token} onJobsCreated={appendJobs} />
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <UnifiedJobsTable jobs={unifiedJobs} />
      </div>
    </PageLayout>
  );
}
