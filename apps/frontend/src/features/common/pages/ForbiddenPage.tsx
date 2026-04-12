import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";

export function ForbiddenPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg space-y-4">
        <Typography as="h1" variant="h2">
          403 Forbidden
        </Typography>
        <Typography as="p" variant="body" className="text-muted-foreground">
          You do not have permission or active entitlement for this page.
        </Typography>
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
