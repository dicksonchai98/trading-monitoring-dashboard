import type { JSX } from "react";

interface AnalyticsEmptyStateProps {
  title: string;
  description: string;
}

export function AnalyticsEmptyState({ title, description }: AnalyticsEmptyStateProps): JSX.Element {
  return (
    <div className="rounded-sm border border-border bg-card p-3 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

