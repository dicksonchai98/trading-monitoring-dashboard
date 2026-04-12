import type { JSX } from "react";
import { useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/ui/page-layout";
import { Typography } from "@/components/ui/typography";

export function AdminAuditPage(): JSX.Element {
  const { pathname } = useLocation();

  return (
    <PageLayout title="Admin Audit Log" bodyClassName="space-y-[var(--panel-gap)]">
      <div className="space-y-1">
        <Typography as="h1" variant="h1" className="text-foreground">
          Admin Audit Log
        </Typography>
        <Typography as="p" variant="meta" className="text-muted-foreground">
          {pathname}
        </Typography>
      </div>
      <Typography as="p" variant="body" className="text-muted-foreground">
        Security-relevant actions for compliance review.
      </Typography>
      <Card>
        <Typography as="p" variant="overline" className="normal-case tracking-normal text-foreground">
          Time | Actor | Action | Target | Result
        </Typography>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>
            <Typography as="p" variant="body" className="text-muted-foreground">
              10:42:03 | admin_01 | role.update | user_118 - member | success
            </Typography>
          </li>
          <li>
            <Typography as="p" variant="body" className="text-muted-foreground">
              10:39:12 | admin_02 | subscription.override | sub_775 | success
            </Typography>
          </li>
          <li>
            <Typography as="p" variant="body" className="text-muted-foreground">
              10:35:41 | admin_01 | role.update | user_301 - admin | denied
            </Typography>
          </li>
        </ul>
      </Card>
    </PageLayout>
  );
}
