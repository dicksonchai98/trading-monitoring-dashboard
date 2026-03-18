import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";

export function ForbiddenPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">403 Forbidden</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission or active entitlement for this page.
        </p>
        <Link
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          to="/subscription"
        >
          Go to Subscription
        </Link>
      </Card>
    </div>
  );
}
