import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";
import { useT } from "@/lib/i18n";

interface UnifiedJobsTableProps {
  jobs: UnifiedLoaderJobRecord[];
}

export function UnifiedJobsTable({ jobs }: UnifiedJobsTableProps): JSX.Element {
  const t = useT();
  const sortedJobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <PanelCard
      title={t("dashboard.loader.unified.title")}
      span={12}
      note={t("dashboard.loader.unified.note")}
    >
      <div className="mt-[var(--panel-gap)] space-y-3 text-sm">
        {sortedJobs.length === 0 ? (
          <p className="text-muted-foreground" data-testid="unified-jobs-empty">
            {t("dashboard.loader.unified.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-border" data-testid="unified-jobs-table">
            <table className="w-full text-left text-xs">
              <thead className="bg-shell text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.source")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.jobId")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.worker")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.jobType")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.status")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.target")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.window")}</th>
                  <th className="px-3 py-2 font-medium">{t("dashboard.loader.unified.createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => (
                  <tr className="border-t border-border" key={`${job.source}-${job.jobId}-${job.createdAt}`}>
                    <td className="px-3 py-2 text-foreground">{job.source}</td>
                    <td className="px-3 py-2 text-foreground">{job.jobId}</td>
                    <td className="px-3 py-2 text-foreground">{job.workerType}</td>
                    <td className="px-3 py-2 text-foreground">{job.jobType}</td>
                    <td className="px-3 py-2 text-foreground">{job.status}</td>
                    <td className="px-3 py-2 text-foreground">{job.target}</td>
                    <td className="px-3 py-2 text-foreground">{job.window}</td>
                    <td className="px-3 py-2 text-foreground">{job.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
