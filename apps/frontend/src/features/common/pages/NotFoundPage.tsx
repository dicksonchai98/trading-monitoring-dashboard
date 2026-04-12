import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Typography } from "@/components/ui/typography";

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
        <Typography as="h1" variant="h2">
          404 Not Found
        </Typography>
        <Typography as="p" variant="body" className="text-muted-foreground">
          The page you requested does not exist.
        </Typography>
        <Link className="typo-body font-semibold text-primary" to="/dashboard">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
