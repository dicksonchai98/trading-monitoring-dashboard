import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SubscriptionPage(): JSX.Element {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Subscription (Mock)</h1>
      <p className="text-sm text-muted-foreground">Intent Pending Active entitlement flow.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="text-sm text-muted-foreground">15s refresh, basic alerts</p>
          <Button variant="outline" className="w-full">
            Current Plan
          </Button>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Pro</h2>
          <p className="text-sm text-muted-foreground">1s refresh, webhook alerts, audit export</p>
          <Button className="w-full">Upgrade (Mock)</Button>
        </Card>
      </div>
    </section>
  );
}
