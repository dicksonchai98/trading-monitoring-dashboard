import type { JSX } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";
import { getBillingStatus, getCheckoutSessionStatus } from "@/features/subscription/api/billing";
import { resolveEntitlementFromBillingStatus } from "@/features/subscription/lib/entitlement";
import { useAuthStore } from "@/lib/store/auth-store";

function BackToDashboardButton(): JSX.Element {
  const navigate = useNavigate();
  return (
    <Button className="min-w-56" onClick={() => navigate("/dashboard")}>
      Back to dashboard
    </Button>
  );
}

interface CheckoutResultLayoutProps {
  kind: "success" | "cancel";
}

function CheckoutVerificationLoading(): JSX.Element {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="flex w-full max-w-xl flex-col items-center gap-5 border-slate-700 bg-slate-950/90 px-8 py-12 text-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-700" />
        <Typography as="p" variant="meta" className="text-slate-400">
          Verifying Checkout
        </Typography>
        <div className="h-4 w-64 animate-pulse rounded bg-slate-700" />
        <div className="h-4 w-48 animate-pulse rounded bg-slate-700" />
      </Card>
    </div>
  );
}

function CheckoutResultLayout({ kind }: CheckoutResultLayoutProps): JSX.Element {
  const navigate = useNavigate();
  const { token, role, resolved, checkoutSessionId, setCheckoutSessionId, setSession } = useAuthStore();
  const [searchParams] = useSearchParams();
  const sessionIdFromQuery = searchParams.get("session_id");
  const effectiveSessionId = sessionIdFromQuery ?? checkoutSessionId;

  useEffect(() => {
    if (sessionIdFromQuery && sessionIdFromQuery !== checkoutSessionId) {
      setCheckoutSessionId(sessionIdFromQuery);
    }
  }, [checkoutSessionId, sessionIdFromQuery, setCheckoutSessionId]);

  const checkoutStatusQuery = useQuery({
    queryKey: ["billing", "checkout-session", token, effectiveSessionId],
    queryFn: () => getCheckoutSessionStatus(token ?? "", effectiveSessionId ?? ""),
    enabled: Boolean(token) && Boolean(effectiveSessionId) && resolved,
    refetchInterval: (query) => {
      if (kind !== "success" || query.state.data?.is_paid) {
        return false;
      }
      return 3000;
    },
    retry: 1,
  });

  const billingStatusQuery = useQuery({
    queryKey: ["billing", "status", "checkout-result", token, effectiveSessionId, checkoutStatusQuery.data?.is_paid],
    queryFn: () => getBillingStatus(token ?? ""),
    enabled:
      Boolean(token) &&
      resolved &&
      ((kind === "success" && checkoutStatusQuery.data?.is_paid === true) ||
        (kind === "cancel" && checkoutStatusQuery.data?.is_paid === false)),
    retry: 1,
  });

  useEffect(() => {
    if (!token || !billingStatusQuery.data) {
      return;
    }
    setSession(token, role, resolveEntitlementFromBillingStatus(billingStatusQuery.data));
  }, [billingStatusQuery.data, role, setSession, token]);

  useEffect(() => {
    if (!resolved) {
      return;
    }
    if (!token || !effectiveSessionId) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (checkoutStatusQuery.isError) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!checkoutStatusQuery.isSuccess) {
      return;
    }
    if (kind === "success" && !checkoutStatusQuery.data.is_paid) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (kind === "cancel" && checkoutStatusQuery.data.is_paid) {
      navigate("/dashboard", { replace: true });
    }
  }, [
    checkoutStatusQuery.data,
    checkoutStatusQuery.isError,
    checkoutStatusQuery.isSuccess,
    effectiveSessionId,
    kind,
    navigate,
    resolved,
    token,
  ]);

  const paymentStatus = checkoutStatusQuery.data?.payment_status ?? null;
  const successVerified = kind === "success" && checkoutStatusQuery.isSuccess && checkoutStatusQuery.data.is_paid;
  const cancelVerified = kind === "cancel" && checkoutStatusQuery.isSuccess && !checkoutStatusQuery.data.is_paid;
  const statusMessage = (() => {
    if (!resolved) {
      return "Checking current session...";
    }
    if (!token) {
      return "Unable to verify payment because you are not logged in.";
    }
    if (!effectiveSessionId) {
      return "No checkout session id found. Please retry from the subscription page.";
    }
    if (checkoutStatusQuery.isLoading) {
      return "Verifying checkout status with billing service...";
    }
    if (checkoutStatusQuery.isError) {
      return "Failed to verify checkout status. Please refresh or retry from subscription.";
    }
    if (kind === "success" && checkoutStatusQuery.data?.is_paid) {
      return "Payment verified. Your entitlement status is being synchronized.";
    }
    if (kind === "success") {
      return "Checkout returned successfully, but payment is not marked as paid yet.";
    }
    return "Checkout was canceled before payment was completed.";
  })();

  if (kind === "success") {
    if (!successVerified) {
      return <CheckoutVerificationLoading />;
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-950 p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.28),transparent_35%),radial-gradient(circle_at_80%_12%,rgba(52,211,153,0.18),transparent_30%)]" />
        <Card className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6 border-emerald-400/30 bg-slate-950/85 px-8 py-14 text-center">
          <div className="rounded-full border border-emerald-300/50 bg-emerald-400/20 p-3 text-emerald-300">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <Typography as="p" variant="meta" className="text-emerald-200/80">
            Payment Completed
          </Typography>
          <Typography as="h1" variant="display" className="tracking-wide text-emerald-100">
            success
          </Typography>
          <Typography as="p" variant="body" className="max-w-lg leading-relaxed text-slate-300">
            {statusMessage}
          </Typography>
          {effectiveSessionId ? (
            <Typography as="p" variant="meta" className="text-slate-400">
              Session: {effectiveSessionId}
            </Typography>
          ) : null}
          {paymentStatus ? (
            <Typography as="p" variant="meta" className="text-slate-400">
              Payment status: {paymentStatus}
            </Typography>
          ) : null}
          <BackToDashboardButton />
        </Card>
      </div>
    );
  }

  if (!cancelVerified) {
    return <CheckoutVerificationLoading />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-slate-950 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.18),transparent_35%),radial-gradient(circle_at_80%_12%,rgba(251,113,133,0.16),transparent_30%)]" />
      <Card className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6 border-rose-300/25 bg-slate-950/85 px-8 py-14 text-center">
        <div className="rounded-full border border-rose-300/50 bg-rose-400/20 p-3 text-rose-300">
          <CircleX className="h-10 w-10" />
        </div>
        <Typography as="p" variant="meta" className="text-rose-100/80">
          Checkout Interrupted
        </Typography>
        <Typography as="h1" variant="display" className="tracking-wide text-rose-100">
          cancel
        </Typography>
        <Typography as="p" variant="body" className="max-w-lg leading-relaxed text-slate-300">
          {statusMessage}
        </Typography>
        {effectiveSessionId ? (
          <Typography as="p" variant="meta" className="text-slate-400">
            Session: {effectiveSessionId}
          </Typography>
        ) : null}
        {paymentStatus ? (
          <Typography as="p" variant="meta" className="text-slate-400">
            Payment status: {paymentStatus}
          </Typography>
        ) : null}
        <BackToDashboardButton />
      </Card>
    </div>
  );
}

export function CheckoutSuccessPage(): JSX.Element {
  return <CheckoutResultLayout kind="success" />;
}

export function CheckoutCancelPage(): JSX.Element {
  return <CheckoutResultLayout kind="cancel" />;
}
