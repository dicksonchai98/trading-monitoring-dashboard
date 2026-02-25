import { Card } from "@/components/ui/card";

export function AdminAuditPage(): JSX.Element {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Admin Audit Log</h1>
      <p className="text-sm text-muted-foreground">
        Security-relevant actions for compliance review.
      </p>
      <Card>
        <p className="text-xs font-semibold text-foreground">
          Time | Actor | Action | Target | Result
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>
            10:42:03 | admin_01 | role.update | user_118 - member | success
          </li>
          <li>
            10:39:12 | admin_02 | subscription.override | sub_775 | success
          </li>
          <li>10:35:41 | admin_01 | role.update | user_301 - admin | denied</li>
        </ul>
      </Card>
    </section>
  );
}
