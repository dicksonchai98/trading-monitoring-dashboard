import type { JSX } from "react";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/ui/page-layout";

export function SubscriptionPage(): JSX.Element {
  return (
    <PageLayout
      title="Subscription (Mock)"
      bodyClassName="space-y-[var(--panel-gap)]"
    >
      <BentoGridSection title="PLAN OPTIONS">
        <Card className="space-y-2 lg:col-span-6 min-h-[calc(var(--panel-row-h)*2)]">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="text-sm text-muted-foreground">
            15s refresh, basic alerts
          </p>
          <Button variant="outline" className="w-full">
            Current Plan
          </Button>
        </Card>
        <Card className="space-y-2 lg:col-span-6">
          <h2 className="text-lg font-semibold">Pro</h2>
          <p className="text-sm text-muted-foreground">
            1s refresh, webhook alerts, audit export
          </p>
          <Button className="w-full">Upgrade (Mock)</Button>
        </Card>
      </BentoGridSection>
    </PageLayout>
  );
}
