import type { JSX } from "react";
import { Link } from "react-router-dom";

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">404 Not Found</h1>
        <p className="text-sm text-muted-foreground">The page you requested does not exist.</p>
        <Link className="text-sm font-semibold text-primary" to="/dashboard">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
