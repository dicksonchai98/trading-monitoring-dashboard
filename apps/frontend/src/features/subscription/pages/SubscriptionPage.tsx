import type { JSX } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
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
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";

function FeatureList({ items }: { items: string[] }): JSX.Element {
  return (
    <ul className="flex flex-col gap-2.5 text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <Typography as="span" variant="body" className="text-muted-foreground">
            {item}
          </Typography>
        </li>
      ))}
    </ul>
  );
}

export function SubscriptionPage(): JSX.Element {
  const t = useT();
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
  const proCtaLabel = isProCurrentPlan ? t("subscription.currentPlan") : t("subscription.getStarted");
  const isBootstrapLoading =
    plansQuery.isLoading || (Boolean(token) && statusQuery.isLoading);
  const freeFeatures = [
    t("subscription.feature.unlimitedMembers"),
    t("subscription.feature.twoTeams"),
    t("subscription.feature.fiveHundredIssues"),
    t("subscription.feature.slackGithub"),
  ];
  const startupFeatures = [
    t("subscription.feature.allFree"),
    t("subscription.feature.aiAssistant"),
    t("subscription.feature.unlimitedTeams"),
    t("subscription.feature.unlimitedIssuesUploads"),
    t("subscription.feature.advancedInsights"),
    t("subscription.feature.adminRoles"),
  ];

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
          <Typography as="h1" variant="display" className="text-foreground md:text-5xl">
            {t("subscription.title")}
          </Typography>
          <Typography as="p" variant="title" className="max-w-xl text-muted-foreground md:text-lg">
            {t("subscription.subtitle")}
          </Typography>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="flex min-h-[600px] flex-col gap-4 rounded-2xl border bg-background p-6 shadow-none hover:bg-background">
            <div className="flex flex-col gap-2">
              <Typography as="p" variant="h2" className="text-foreground">
                {t("subscription.free")}
              </Typography>
              <Typography as="p" variant="display" className="text-foreground text-3xl">
                {t("subscription.freePrice")}
              </Typography>
            </div>
            <Typography as="p" variant="body" className="text-muted-foreground">
              {t("subscription.freeDesc")}
            </Typography>
            <FeatureList items={freeFeatures} />
          </Card>

          <Card className="flex min-h-[400px] flex-col gap-4 rounded-2xl border-2 border-foreground bg-background p-6 shadow-none hover:bg-background">
            <div className="flex flex-col gap-2">
              <Typography as="p" variant="h2" className="text-foreground">
                {t("subscription.proPlan")}
              </Typography>
              <Typography as="p" variant="display" className="text-foreground text-3xl">
                {t("subscription.proPrice")}
              </Typography>
            </div>
            <FeatureList items={startupFeatures} />
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
