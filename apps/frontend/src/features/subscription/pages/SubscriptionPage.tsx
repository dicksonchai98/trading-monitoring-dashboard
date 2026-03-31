import type { JSX } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBillingPlans, getBillingStatus, startCheckout } from "@/features/subscription/api/billing";
import { mapEntitlement, resolveEntitlementFromBillingStatus } from "@/features/subscription/lib/entitlement";
import { useAuthStore } from "@/lib/store/auth-store";
import { PageLayout } from "@/components/ui/page-layout";
import type { BillingPlan } from "@/features/subscription/api/types";

function statusVariant(status: string): "neutral" | "warning" | "success" {
  if (status === "active") {
    return "success";
  }
  if (status === "checkout_started" || status === "pending") {
    return "warning";
  }
  return "neutral";
}

function isFreePlan(plan: BillingPlan): boolean {
  return plan.id.toLowerCase() === "free" || plan.price.toLowerCase() === "free";
}

export function SubscriptionPage(): JSX.Element {
  const { token, setSession, setCheckoutSessionId, role, entitlement } = useAuthStore();
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
    onSuccess: async (result) => {
      setCheckoutSessionId(result.session_id);

      const refreshed = token ? await statusQuery.refetch() : undefined;
      const nextStatus = refreshed?.data?.status ?? currentStatus;
      if (token) {
        const nextEntitlement = refreshed?.data
          ? resolveEntitlementFromBillingStatus(refreshed.data)
          : mapEntitlement(nextStatus);
        setSession(token, role, nextEntitlement);
      }

      const isJsdom =
        typeof window !== "undefined" &&
        typeof window.navigator !== "undefined" &&
        /jsdom/i.test(window.navigator.userAgent);

      if (!isJsdom && result.checkout_url) {
        window.location.assign(result.checkout_url);
      }
    },
  });
  const plans = plansQuery.data?.plans ?? [];
  const currentStatus = statusQuery.data?.status ?? entitlement;
  const hasCheckedOut = ["checkout_started", "pending", "active", "past_due"].includes(
    String(currentStatus),
  );

  return (
    <PageLayout
      title="Subscription"
      className="flex min-h-[calc(100dvh-(var(--shell-padding)*2))] flex-col"
      bodyClassName="flex flex-1 flex-col"
    >
      <BentoGridSection
        title="PLAN OPTIONS"
        className="flex flex-1 flex-col"
        gridClassName="h-full flex-1 auto-rows-fr"
      >
        {plans.map((plan) => {
          const freePlan = isFreePlan(plan);
          const isCurrentPlan = freePlan ? !hasCheckedOut : hasCheckedOut;
          const canCheckout = !freePlan && !hasCheckedOut;

          return (
            <Card key={plan.id} className="flex h-full min-h-[calc(var(--panel-row-h)*2)] flex-col gap-3 lg:col-span-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <div className="flex items-center gap-2">
                  {isCurrentPlan ? <Badge variant="success">Current plan</Badge> : null}
                  <Badge variant={statusVariant(String(currentStatus))}>Entitlement: {currentStatus}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Price: {plan.price}</p>
              <p className="text-sm text-muted-foreground">
                {freePlan
                  ? "Free plan does not require checkout."
                  : "Paid plan uses checkout flow and syncs billing status."}
              </p>
              {!freePlan ? (
                <Button
                  className="mt-auto w-full"
                  disabled={!token || checkoutMutation.isPending || !canCheckout}
                  onClick={() => checkoutMutation.mutate()}
                >
                  {isCurrentPlan
                    ? "Current plan"
                    : checkoutMutation.isPending
                      ? "Starting checkout..."
                      : "Start Checkout"}
                </Button>
              ) : null}
            </Card>
          );
        })}
      </BentoGridSection>
    </PageLayout>
  );
}
