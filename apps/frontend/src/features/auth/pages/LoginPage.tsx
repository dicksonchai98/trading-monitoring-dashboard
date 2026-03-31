import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { type FieldPath, type FieldValues, type UseFormRegister, useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { login, register, sendEmailOtp, verifyEmailOtp } from "@/features/auth/api/auth";
import { decodeAccessToken, mapTokenRole } from "@/features/auth/lib/token";
import { getBillingStatus } from "@/features/subscription/api/billing";
import { mapEntitlement, resolveEntitlementFromBillingStatus } from "@/features/subscription/lib/entitlement";
import { loginSchema, registerSchema, type LoginFormValues, type RegisterFormValues } from "@/features/auth/validation/auth-schema";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils/cn";

type AuthMode = "login" | "register";
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function getRedirectTarget(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state && typeof state.from === "string") {
    return state.from;
  }
  return "/dashboard";
}

function formatAuthError(message: string | undefined): string | null {
  switch (message) {
    case "invalid_credentials":
      return "Invalid credentials.";
    case "user_exists":
      return "This email is already registered.";
    case "verification_required":
      return "Please verify your email before registering.";
    case "invalid_email":
      return "Please provide a valid email address.";
    case "invalid_otp":
      return "Invalid verification code.";
    case "expired":
      return "Verification code expired. Please request a new one.";
    case "cooldown":
    case "rate_limited":
      return "Verification email sent too frequently. Please try again shortly.";
    case "locked":
      return "Too many failed attempts. Please request a new verification code.";
    case "auth_request_failed":
    case "api_request_failed":
      return "Authentication request failed.";
    case "invalid_access_token":
    case "unsupported_role":
      return "Received an invalid session token from the server.";
    default:
      return message ? "Unable to complete authentication." : null;
  }
}

interface FormShellProps {
  title: string;
  description: string;
  errorMessage: string | null;
  children: JSX.Element | JSX.Element[];
}

function FormShell({ title, description, errorMessage, children }: FormShellProps): JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {errorMessage ? (
        <div className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{errorMessage}</div>
      ) : null}
      {children}
    </>
  );
}

interface InputFieldProps {
  label: string;
  type?: "text" | "password";
  error?: string;
  disabled?: boolean;
}

interface GenericInputFieldProps<TFieldValues extends FieldValues> extends InputFieldProps {
  registration: UseFormRegister<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

function InputField<TFieldValues extends FieldValues>({
  label,
  type = "text",
  error,
  disabled = false,
  registration,
  name,
}: GenericInputFieldProps<TFieldValues>): JSX.Element {
  return (
    <label className="space-y-2 text-sm text-foreground">
      <span className="block">{label}</span>
      <input
        type={type}
        disabled={disabled}
        className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        {...registration(name)}
      />
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

interface AuthFormProps {
  onAuthenticated: (token: string) => Promise<void>;
}

function LoginForm({ onAuthenticated }: AuthFormProps): JSX.Element {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => onAuthenticated(data.access_token),
  });

  return (
    <FormShell
      title="Sign in"
      description="Use your trading workspace credentials to continue."
      errorMessage={formatAuthError(mutation.error instanceof Error ? mutation.error.message : undefined)}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          mutation.reset();
          mutation.mutate(values);
        })}
      >
        <InputField
          label="Username"
          disabled={mutation.isPending}
          error={form.formState.errors.username?.message}
          registration={form.register}
          name="username"
        />
        <InputField
          label="Password"
          type="password"
          disabled={mutation.isPending}
          error={form.formState.errors.password?.message}
          registration={form.register}
          name="password"
        />
        <Button className="w-full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </FormShell>
  );
}

function RegisterForm({ onAuthenticated }: AuthFormProps): JSX.Element {
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSentEmail, setOtpSentEmail] = useState<string | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const currentEmail = form.watch("email");
  const hasOtpSent = otpSentEmail === currentEmail && currentEmail.length > 0;
  const isEmailVerified = Boolean(verificationToken && verifiedEmail === currentEmail);

  const sendOtpMutation = useMutation({
    mutationFn: sendEmailOtp,
    onSuccess: (_, variables) => {
      setVerificationToken(null);
      setVerifiedEmail(null);
      setOtpCode("");
      setOtpSentEmail(variables.email);
      setResendCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
      setOtpMessage("Verification code sent. Check your email inbox.");
      setLocalError(null);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: verifyEmailOtp,
    onSuccess: (data) => {
      const email = form.getValues("email");
      setVerificationToken(data.verification_token);
      setVerifiedEmail(email);
      setOtpModalOpen(false);
      setOtpMessage("Email verified. You can finish registration now.");
      setLocalError(null);
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: async (data) => onAuthenticated(data.access_token),
  });

  const isPending = sendOtpMutation.isPending || verifyOtpMutation.isPending || registerMutation.isPending;
  const errorMessage =
    localError ??
    formatAuthError(registerMutation.error instanceof Error ? registerMutation.error.message : undefined) ??
    formatAuthError(verifyOtpMutation.error instanceof Error ? verifyOtpMutation.error.message : undefined) ??
    formatAuthError(sendOtpMutation.error instanceof Error ? sendOtpMutation.error.message : undefined);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }
    const timerId = window.setTimeout(() => {
      setResendCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timerId);
  }, [resendCooldownSeconds]);

  useEffect(() => {
    if (!verifiedEmail || currentEmail === verifiedEmail) {
      return;
    }
    setVerificationToken(null);
    setVerifiedEmail(null);
    setOtpSentEmail(null);
    setResendCooldownSeconds(0);
    setOtpCode("");
    setOtpMessage(null);
  }, [currentEmail, verifiedEmail]);

  async function handleSendOtp(): Promise<void> {
    setLocalError(null);
    sendOtpMutation.reset();
    verifyOtpMutation.reset();
    const isValidEmail = await form.trigger("email");
    if (!isValidEmail) {
      return;
    }
    const email = form.getValues("email");
    setVerificationToken(null);
    setVerifiedEmail(null);
    setOtpSentEmail(null);
    setOtpCode("");
    sendOtpMutation.mutate({ email });
  }

  async function handleVerifyOtp(): Promise<void> {
    setLocalError(null);
    verifyOtpMutation.reset();
    const isValidEmail = await form.trigger("email");
    if (!isValidEmail) {
      return;
    }
    if (!otpCode.trim()) {
      setLocalError("Verification code is required.");
      return;
    }
    if (!hasOtpSent) {
      setLocalError("Please send a verification code first.");
      return;
    }
    const email = form.getValues("email");
    verifyOtpMutation.mutate({ email, otp_code: otpCode.trim() });
  }

  async function handleOpenOtpModal(): Promise<void> {
    setLocalError(null);
    setOtpMessage(null);
    sendOtpMutation.reset();
    verifyOtpMutation.reset();
    const isValid = await form.trigger("email");
    if (!isValid) {
      return;
    }
    setOtpModalOpen(true);
    if (!hasOtpSent) {
      await handleSendOtp();
    }
  }

  return (
    <FormShell
      title="Create account"
      description="Register a new operator account for the monitoring console."
      errorMessage={errorMessage}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          registerMutation.reset();
          if (!verificationToken || verifiedEmail !== values.email) {
            setLocalError("Please verify your email before registering.");
            return;
          }
          registerMutation.mutate({
            username: values.email,
            password: values.password,
            verification_token: verificationToken,
          });
        })}
      >
        <InputField
          label="Email"
          disabled={isPending}
          error={form.formState.errors.email?.message}
          registration={form.register}
          name="email"
        />
        <InputField
          label="Password"
          type="password"
          disabled={isPending}
          error={form.formState.errors.password?.message}
          registration={form.register}
          name="password"
        />
        <InputField
          label="Confirm password"
          type="password"
          disabled={isPending}
          error={form.formState.errors.confirmPassword?.message}
          registration={form.register}
          name="confirmPassword"
        />
        <Button className="w-full" type="button" variant="outline" disabled={isPending} onClick={() => void handleOpenOtpModal()}>
          {isEmailVerified ? "Verified email address" : "Verify email address"}
        </Button>
        {otpMessage ? <p className="text-xs text-primary">{otpMessage}</p> : null}
        {isEmailVerified ? (
          <Button className="w-full" type="submit" disabled={isPending}>
            {registerMutation.isPending ? "Registering..." : "Register"}
          </Button>
        ) : null}
      </form>
      {otpModalOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm space-y-4 border-border-strong bg-shell p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Verify email address</h2>
              <p className="text-xs text-muted-foreground">Enter the verification code sent to your email.</p>
            </div>
            <label className="space-y-2 text-sm text-foreground">
              <span className="block">Verification code</span>
              <input
                type="text"
                value={otpCode}
                disabled={isPending}
                onChange={(event) => setOtpCode(event.target.value)}
                className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            {hasOtpSent && resendCooldownSeconds > 0 ? (
              <p className="text-xs text-muted-foreground">You can resend a verification code in {resendCooldownSeconds} seconds.</p>
            ) : null}
            <div className="flex gap-2">
              <Button className="flex-1" type="button" variant="outline" disabled={isPending} onClick={() => setOtpModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                type="button"
                variant="outline"
                disabled={isPending || (hasOtpSent && resendCooldownSeconds > 0)}
                onClick={() => void handleSendOtp()}
              >
                {sendOtpMutation.isPending
                  ? "Sending..."
                  : hasOtpSent
                    ? resendCooldownSeconds > 0
                      ? `Resend in ${resendCooldownSeconds}s`
                      : "Resend code"
                    : "Send code"}
              </Button>
              <Button className="flex-1" type="button" disabled={isPending || !hasOtpSent} onClick={() => void handleVerifyOtp()}>
                {verifyOtpMutation.isPending ? "Verifying..." : "Verify email"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </FormShell>
  );
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const { role, setSession } = useAuthStore();
  const redirectTarget = getRedirectTarget(location.state);

  if (role !== "visitor") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleAuthenticated(token: string): Promise<void> {
    const payload = decodeAccessToken(token);
    const nextRole = mapTokenRole(payload.role);
    let nextEntitlement = mapEntitlement("none");
    try {
      const status = await getBillingStatus(token);
      nextEntitlement = resolveEntitlementFromBillingStatus(status);
    } catch {
      nextEntitlement = mapEntitlement("none");
    }
    setSession(token, nextRole, nextEntitlement);
    navigate(redirectTarget, { replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
      <Card className="relative z-10 w-full max-w-md space-y-6 border-border-strong bg-shell/95 p-6 backdrop-blur">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">Trading Monitoring Console</p>
          <div className="grid grid-cols-2 gap-2 rounded-sm border border-border bg-background/70 p-1">
            <button
              type="button"
              className={cn(
                "h-9 rounded-sm text-sm transition-colors",
                mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={cn(
                "h-9 rounded-sm text-sm transition-colors",
                mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setMode("register")}
            >
              Create account
            </button>
          </div>
        </div>

        {mode === "login" ? <LoginForm onAuthenticated={handleAuthenticated} /> : <RegisterForm onAuthenticated={handleAuthenticated} />}
      </Card>
    </div>
  );
}
