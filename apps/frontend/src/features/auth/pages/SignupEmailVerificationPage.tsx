import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GlobeDemo from "@/components/globe-demo";
import { SignupForm } from "@/components/signup-form";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { register, sendEmailOtp, verifyEmailOtp } from "@/features/auth/api/auth";
import { applyAuthenticatedSession, formatAuthError, getRedirectTarget } from "@/features/auth/lib/auth-page-shared";
import type { RegisterFormValues } from "@/features/auth/validation/auth-schema";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

interface SignupVerifyPageState {
  registration: RegisterFormValues;
  from?: string;
}

function getPageState(state: unknown): SignupVerifyPageState | null {
  if (typeof state !== "object" || state === null || !("registration" in state)) {
    return null;
  }
  const value = state as { registration?: RegisterFormValues; from?: string };
  if (!value.registration?.email || !value.registration.user_id || !value.registration.password) {
    return null;
  }
  return {
    registration: value.registration,
    from: value.from,
  };
}

export function SignupEmailVerificationPage(): JSX.Element {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, resolved, setSession } = useAuthStore();
  const pageState = useMemo(() => getPageState(location.state), [location.state]);
  const hasShownInitialToast = useRef(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(OTP_RESEND_COOLDOWN_SECONDS);
  const [localError, setLocalError] = useState<string | null>(null);
  const redirectTarget = getRedirectTarget(location.state);

  const resendMutation = useMutation({
    mutationFn: sendEmailOtp,
    onSuccess: () => {
      setResendCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
      toast.success(t("auth.verify.sent"));
      setLocalError(null);
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: async (data) => {
      await applyAuthenticatedSession({ token: data.access_token, source: "register", setSession, t });
      navigate(redirectTarget, { replace: true });
    },

  });

  const verifyMutation = useMutation({
    mutationFn: verifyEmailOtp,
    onSuccess: (data) => {
      if (!pageState) {
        navigate("/signup", { replace: true });
        return;
      }
      setLocalError(null);
      toast.success(t("auth.verify.creating"));
      registerMutation.mutate({
        user_id: pageState.registration.user_id,
        email: pageState.registration.email,
        password: pageState.registration.password,
        verification_token: data.verification_token,
      });
    },
  });

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => setResendCooldownSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [resendCooldownSeconds]);

  useEffect(() => {
    if (hasShownInitialToast.current) {
      return;
    }
    hasShownInitialToast.current = true;
    toast.success(t("auth.verify.sent"));
  }, [t]);

  if (!resolved) {
    return <PageSkeleton />;
  }

  if (role !== "visitor") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!pageState) {
    return <Navigate to="/signup" replace />;
  }

  const errorMessage =
    localError ??
    formatAuthError(t, registerMutation.error instanceof Error ? registerMutation.error.message : undefined) ??
    formatAuthError(t, verifyMutation.error instanceof Error ? verifyMutation.error.message : undefined) ??
    formatAuthError(t, resendMutation.error instanceof Error ? resendMutation.error.message : undefined);

  return (
    <div className="grid min-h-screen w-full bg-white md:grid-cols-2">
      <section className="flex items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900 md:px-10">
        <div className="w-full max-w-sm">
        <SignupForm
          mode="verify"
          email={pageState.registration.email}
          otpCode={otpCode}
          errorMessage={errorMessage}
          resendCooldownSeconds={resendCooldownSeconds}
          isSending={resendMutation.isPending}
          isVerifying={verifyMutation.isPending || registerMutation.isPending}
          onOtpCodeChange={setOtpCode}
          onResendCode={() => {
            setLocalError(null);
            resendMutation.reset();
            resendMutation.mutate({ email: pageState.registration.email });
          }}
          onVerifyAndCreate={() => {
            setLocalError(null);
            verifyMutation.reset();
            registerMutation.reset();
            if (otpCode.trim().length !== 6) {
              setLocalError(t("auth.verify.required"));
              return;
            }
            verifyMutation.mutate({ email: pageState.registration.email, otp_code: otpCode.trim() });
          }}
        />
        </div>
      </section>
      <section className="relative min-h-[560px] overflow-hidden bg-black">
        <GlobeDemo />
      </section>
    </div>
  );
}
