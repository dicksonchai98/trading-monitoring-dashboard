import type { JSX } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBillingPlans, getBillingStatus, startCheckout } from "@/features/subscription/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";
import { PageLayout } from "@/components/ui/page-layout";

function mapEntitlement(status: string): "none" | "pending" | "active" {
  if (status === "active") {
    return "active";
  }
  if (status === "pending" || status === "checkout_started") {
    return "pending";
  }
  return "none";
}

function statusVariant(status: string): "neutral" | "warning" | "success" {
  if (status === "active") {
    return "success";
  }
  if (status === "checkout_started" || status === "pending") {
    return "warning";
  }
  return "neutral";
}

export function SubscriptionPage(): JSX.Element {
  const { token, setSession, role, entitlement } = useAuthStore();
  const plansQuery = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: getBillingPlans,
  });
  const statusQuery = useQuery({
    queryKey: ["billing", "status", token],
    queryFn: () => getBillingStatus(token ?? ""),
    enabled: Boolean(token),
  });
  const checkoutMutation = useMutation({
    mutationFn: () => startCheckout(token ?? ""),
    onSuccess: async () => {
      const refreshed = token ? await statusQuery.refetch() : undefined;
      const nextStatus = refreshed?.data?.status ?? currentStatus;
      if (token) {
        setSession(token, role, mapEntitlement(nextStatus));
      }
    },
  });

  const plans = plansQuery.data?.plans ?? [];
  const currentStatus = statusQuery.data?.status ?? entitlement;
  const checkoutSessionId = checkoutMutation.data?.session_id ?? null;
  const checkoutUrl = checkoutMutation.data?.checkout_url ?? null;

  return (
    <PageLayout
      title="Subscription (Mock)"
      className="flex min-h-[calc(100dvh-(var(--shell-padding)*2))] flex-col"
      bodyClassName="flex flex-1 flex-col"
    >
      <BentoGridSection
        title="PLAN OPTIONS"
        className="flex flex-1 flex-col"
        gridClassName="h-full flex-1 auto-rows-fr"
      >
        <Card className="flex h-full min-h-[calc(var(--panel-row-h)*2)] flex-col gap-3 lg:col-span-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{plans[0]?.name ?? "Loading..."}</h2>
            <Badge variant={statusVariant(String(currentStatus))}>Entitlement: {currentStatus}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Mock billing currently exposes one plan and a coarse subscription status only.
          </p>
          <p className="text-sm text-muted-foreground">Price: {plans[0]?.price ?? "..."}</p>
          {checkoutSessionId ? (
            <p className="text-sm text-muted-foreground">Checkout session: {checkoutSessionId}</p>
          ) : null}
          {checkoutUrl ? (
            <a className="text-sm text-primary underline-offset-4 hover:underline" href={checkoutUrl} target="_blank" rel="noreferrer">
              Open checkout page
            </a>
          ) : null}
          <Button
            className="mt-auto w-full"
            disabled={!token || checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? "Starting checkout..." : "Start Checkout"}
          </Button>
        </Card>
      </BentoGridSection>
    </PageLayout>
  );
}
