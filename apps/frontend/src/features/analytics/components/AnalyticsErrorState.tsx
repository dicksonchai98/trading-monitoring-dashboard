import type { JSX } from "react";
import { Button } from "@/components/ui/button";

interface AnalyticsErrorStateProps {
  status?: number;
  onRetry?: () => void;
}

export function AnalyticsErrorState({ status, onRetry }: AnalyticsErrorStateProps): JSX.Element {
  let message = "Unable to load analytics data.";
  if (status === 400) {
    message = "Invalid analytics filter parameters.";
  } else if (status === 404) {
    message = "Unknown event/metric ID or no analytics data published.";
  } else if (status === 500) {
    message = "Server error while loading analytics data.";
  }

  return (
    <div className="space-y-2 rounded-sm border border-border bg-card p-3 text-sm">
      <p>{message}</p>
      {onRetry ? (
        <Button size="sm" type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

