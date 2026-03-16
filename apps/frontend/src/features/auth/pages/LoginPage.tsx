import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useState } from "react";
import { type FieldPath, type FieldValues, type UseFormRegister, useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { login, register } from "@/features/auth/api/auth";
import { decodeAccessToken, mapTokenRole } from "@/features/auth/lib/token";
import { loginSchema, registerSchema, type LoginFormValues, type RegisterFormValues } from "@/features/auth/validation/auth-schema";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils/cn";

type AuthMode = "login" | "register";

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
      return "This username is already registered.";
    case "auth_request_failed":
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
  onAuthenticated: (token: string) => void;
}

function LoginForm({ onAuthenticated }: AuthFormProps): JSX.Element {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => onAuthenticated(data.access_token),
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
    defaultValues: { username: "", password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => onAuthenticated(data.access_token),
  });

  return (
    <FormShell
      title="Create account"
      description="Register a new operator account for the monitoring console."
      errorMessage={formatAuthError(mutation.error instanceof Error ? mutation.error.message : undefined)}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          mutation.reset();
          mutation.mutate({ username: values.username, password: values.password });
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
        <InputField
          label="Confirm password"
          type="password"
          disabled={mutation.isPending}
          error={form.formState.errors.confirmPassword?.message}
          registration={form.register}
          name="confirmPassword"
        />
        <Button className="w-full" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Registering..." : "Register"}
        </Button>
      </form>
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

  function handleAuthenticated(token: string): void {
    const payload = decodeAccessToken(token);
    const nextRole = mapTokenRole(payload.role);
    setSession(token, nextRole, "active");
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
