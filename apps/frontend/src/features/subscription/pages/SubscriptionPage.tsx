import type { JSX } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getBillingPlans,
  getBillingStatus,
  startCheckout,
} from "@/features/subscription/api/billing";
import { SubscriptionPageSkeleton } from "@/features/subscription/components/SubscriptionPageSkeleton";
import {
  mapEntitlement,
  resolveEntitlementFromBillingStatus,
} from "@/features/subscription/lib/entitlement";
import { useAuthStore } from "@/lib/store/auth-store";

const FREE_FEATURES = [
  "Unlimited members",
  "2 teams",
  "500 issues",
  "Slack and Github integrations",
];
const STARTUP_FEATURES = [
  "All free plan features and...",
  "AI Assistant",
  "Unlimited teams",
  "Unlimited issues and file uploads",
  "Advanced Insights",
  "Admin roles",
];

function FeatureList({ items }: { items: string[] }): JSX.Element {
  return (
    <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SubscriptionPage(): JSX.Element {
  const navigate = useNavigate();
  const { token, setSession, setCheckoutSessionId, role, entitlement } =
    useAuthStore();

  const plansQuery = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: getBillingPlans,
  });
  const statusQuery = useQuery({
    queryKey: ["billing", "status", token],
    queryFn: () => getBillingStatus(token ?? ""),
    enabled: Boolean(token),
  });

  const currentStatus = statusQuery.data?.status ?? entitlement;
  const isProCurrentPlan = String(currentStatus) === "active";
  const proCtaLabel = isProCurrentPlan ? "Current plan" : "Get started";
  const isBootstrapLoading =
    plansQuery.isLoading || (Boolean(token) && statusQuery.isLoading);

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

  if (isBootstrapLoading) {
    return <SubscriptionPageSkeleton />;
  }

  return (
    <main
      className="min-h-screen bg-muted/40 px-6 py-16 text-foreground md:px-10"
      data-testid="pricing-page"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Pricing
          </h1>
          <p className="max-w-xl text-base text-muted-foreground md:text-lg">
            Use for free with your whole team. Upgrade to enable unlimited
            issues, enhanced security controls, and additional features.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="flex min-h-[600px] flex-col gap-4 rounded-2xl border bg-background p-6 shadow-none hover:bg-background">
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold text-foreground">Free</p>
              <p className="text-3xl font-semibold text-foreground">$0</p>
            </div>
            <p className="text-sm text-muted-foreground">Free for everyone</p>
            <FeatureList items={FREE_FEATURES} />
          </Card>

          <Card className="flex min-h-[400px] flex-col gap-4 rounded-2xl border-2 border-foreground bg-background p-6 shadow-none hover:bg-background">
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold text-foreground">Pro Plan</p>
              <p className="text-3xl font-semibold text-foreground">$6 per user/year</p>
            </div>
            <FeatureList items={STARTUP_FEATURES} />
            <Button
              className="mt-auto w-fit rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              disabled={checkoutMutation.isPending || isProCurrentPlan}
              onClick={() => {
                if (!token) {
                  navigate("/login", { state: { from: "/subscription" } });
                  return;
                }
                checkoutMutation.mutate();
              }}
            >
              {proCtaLabel}
            </Button>
          </Card>
        </section>
      </div>
    </main>
  );
}
