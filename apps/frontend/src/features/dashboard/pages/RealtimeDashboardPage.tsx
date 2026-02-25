import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function RealtimeDashboardPage(): JSX.Element {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Realtime Market Dashboard</h1>
        <Badge className="bg-emerald-500/20 text-emerald-300">SSE Connected</Badge>
      </header>
      <p className="text-sm text-muted-foreground">Near-month Taiwan index futures (MVP scope).</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-muted-foreground">Last Price</p>
          <p className="text-2xl font-semibold">22,438</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">1s Change</p>
          <p className="text-2xl font-semibold text-emerald-400">+18 (+0.08%)</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Snapshot Age</p>
          <p className="text-2xl font-semibold">0.9s</p>
        </Card>
      </div>
    </section>
  );
}
