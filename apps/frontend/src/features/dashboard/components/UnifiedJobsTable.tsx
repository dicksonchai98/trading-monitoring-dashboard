import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import type { UnifiedLoaderJobRecord } from "@/features/dashboard/types/loader-jobs";

interface UnifiedJobsTableProps {
  jobs: UnifiedLoaderJobRecord[];
}

export function UnifiedJobsTable({ jobs }: UnifiedJobsTableProps): JSX.Element {
  const sortedJobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <PanelCard title="Unified Job Feed" span={12} note="Merged backfill and crawler tasks.">
      <div className="mt-[var(--panel-gap)] space-y-3 text-sm">
        {sortedJobs.length === 0 ? (
          <p className="text-muted-foreground" data-testid="unified-jobs-empty">
            No jobs yet. Trigger backfill or crawler tasks to see records.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-border" data-testid="unified-jobs-table">
            <table className="w-full text-left text-xs">
              <thead className="bg-shell text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Job ID</th>
                  <th className="px-3 py-2 font-medium">Worker</th>
                  <th className="px-3 py-2 font-medium">Job Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Window</th>
                  <th className="px-3 py-2 font-medium">Created At</th>
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
