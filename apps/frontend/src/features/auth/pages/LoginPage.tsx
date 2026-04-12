import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/login-form";
import { Typography } from "@/components/ui/typography";
import { login } from "@/features/auth/api/auth";
import { AuthSplitPageSkeleton } from "@/features/auth/components/AuthSplitPageSkeleton";
import { applyAuthenticatedSession, formatAuthError, getRedirectTarget } from "@/features/auth/lib/auth-page-shared";
import { loginSchema, type LoginFormValues } from "@/features/auth/validation/auth-schema";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";

export function LoginPage(): JSX.Element {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, resolved, setSession } = useAuthStore();
  const redirectTarget = getRedirectTarget(location.state);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { user_id: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      await applyAuthenticatedSession({ token: data.access_token, source: "login", setSession });
      navigate(redirectTarget, { replace: true });
    },
  });

  if (!resolved) {
    return <AuthSplitPageSkeleton />;
  }

  if (role !== "visitor") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="grid min-h-screen w-full bg-white md:grid-cols-2">
      <section className="flex items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900 md:px-10">
        <div className="w-full max-w-sm">
          <LoginForm
            userId={form.watch("user_id")}
            password={form.watch("password")}
            userIdError={form.formState.errors.user_id?.message}
            passwordError={form.formState.errors.password?.message}
            errorMessage={formatAuthError(mutation.error instanceof Error ? mutation.error.message : undefined)}
            isPending={mutation.isPending}
            onUserIdChange={(value) => form.setValue("user_id", value, { shouldDirty: true, shouldValidate: true })}
            onPasswordChange={(value) => form.setValue("password", value, { shouldDirty: true, shouldValidate: true })}
            onSubmit={() => {
              void form.handleSubmit((values) => {
                mutation.reset();
                mutation.mutate(values);
              })();
            }}
          />
        </div>
      </section>
      <section className="relative hidden md:block">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=1800&q=80"
            alt={t("auth.hero.coverAlt")}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <Typography as="p" variant="meta" className="text-white/80">
            {t("app.console")}
          </Typography>
          <Typography as="h2" variant="h2" className="mt-3 text-white">
            {t("auth.hero.login.title")}
          </Typography>
          <Typography as="p" variant="body" className="mt-3 max-w-md text-white/90">
            {t("auth.hero.login.desc")}
          </Typography>
        </div>
      </section>
    </div>
  );
}
