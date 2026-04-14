import type { JSX } from "react";

function SkeletonBlock({ className }: { className: string }): JSX.Element {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />;
}

function PlanCardSkeleton(): JSX.Element {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-6 w-20" />
      </div>
      <div className="flex items-end gap-2">
        <SkeletonBlock className="h-9 w-24" />
        <SkeletonBlock className="h-4 w-12" />
      </div>
      <SkeletonBlock className="h-px w-full rounded-none" />
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
      <SkeletonBlock className="h-6 w-40" />
      <SkeletonBlock className="h-10 w-36" />
    </div>
  );
}

export function SubscriptionPageSkeleton(): JSX.Element {
  return (
    <main data-testid="page-skeleton" className="min-h-screen bg-background px-6 py-10 text-foreground md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="flex flex-col items-center gap-3 text-center">
          <SkeletonBlock className="h-10 w-40" />
          <SkeletonBlock className="h-4 w-96 max-w-full" />
          <SkeletonBlock className="h-10 w-72" />
        </section>
        <SkeletonBlock className="h-px w-full rounded-none" />
        <section className="grid gap-4 md:grid-cols-3">
          <PlanCardSkeleton />
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </section>
      </div>
    </main>
  );
}
