import type { JSX } from "react";
import { cn } from "@/lib/utils/cn";

interface PageSkeletonProps {
  className?: string;
  testId?: string;
}

export function PageSkeleton({ className, testId = "page-skeleton" }: PageSkeletonProps): JSX.Element {
  return (
    <div data-testid={testId} className={cn("space-y-5 p-4", className)}>
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded-sm bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded-sm bg-muted/80" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-24 animate-pulse rounded-md bg-muted/70" />
        <div className="h-24 animate-pulse rounded-md bg-muted/70" />
        <div className="h-24 animate-pulse rounded-md bg-muted/70" />
        <div className="h-24 animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="h-44 animate-pulse rounded-md bg-muted/65" />
        <div className="h-44 animate-pulse rounded-md bg-muted/65" />
        <div className="h-44 animate-pulse rounded-md bg-muted/65" />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="h-52 animate-pulse rounded-md bg-muted/60" />
        <div className="h-52 animate-pulse rounded-md bg-muted/60" />
      </div>
    </div>
  );
}
