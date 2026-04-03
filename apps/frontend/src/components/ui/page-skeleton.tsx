import type { JSX } from "react";
import { cn } from "@/lib/utils/cn";

interface PageSkeletonProps {
  className?: string;
  testId?: string;
}

export function PageSkeleton({ className, testId = "page-skeleton" }: PageSkeletonProps): JSX.Element {
  return (
    <div data-testid={testId} className={cn("space-y-4 p-4", className)}>
      <div className="h-8 w-48 animate-pulse rounded-sm bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded-sm bg-muted/80" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-36 animate-pulse rounded-md bg-muted/70" />
        <div className="h-36 animate-pulse rounded-md bg-muted/70" />
        <div className="h-36 animate-pulse rounded-md bg-muted/70" />
      </div>
    </div>
  );
}
