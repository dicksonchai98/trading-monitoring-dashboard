import type { JSX } from "react";

function SkeletonBlock({ className }: { className: string }): JSX.Element {
  return <div className={`animate-pulse rounded-xl bg-zinc-200 ${className}`} />;
}

export function AuthSplitPageSkeleton(): JSX.Element {
  return (
    <div data-testid="page-skeleton" className="grid min-h-screen w-full bg-white md:grid-cols-2">
      <section className="flex items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900 md:px-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-9 w-64" />
            <SkeletonBlock className="h-4 w-72" />
          </div>
          <div className="space-y-4">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
          <div className="space-y-4">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="mx-auto h-4 w-44" />
        </div>
      </section>
      <section className="relative hidden md:block">
        <div className="absolute inset-0 animate-pulse bg-zinc-300" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-10 left-10 right-10 space-y-3">
          <div className="h-3 w-40 animate-pulse rounded bg-white/40" />
          <div className="h-8 w-4/5 animate-pulse rounded bg-white/50" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/45" />
        </div>
      </section>
    </div>
  );
}
