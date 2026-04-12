import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { SignupForm } from "@/components/signup-form";
import { sendEmailOtp } from "@/features/auth/api/auth";
import { AuthSplitPageSkeleton } from "@/features/auth/components/AuthSplitPageSkeleton";
import { formatAuthError } from "@/features/auth/lib/auth-page-shared";
import { registerSchema, type RegisterFormValues } from "@/features/auth/validation/auth-schema";
import { useAuthStore } from "@/lib/store/auth-store";

interface SignupVerifyPageState {
  registration: RegisterFormValues;
}

export function SignupPage(): JSX.Element {
  const navigate = useNavigate();
  const { role, resolved } = useAuthStore();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { user_id: "", email: "", password: "", confirmPassword: "" },
  });

  const sendOtpMutation = useMutation({
    mutationFn: sendEmailOtp,
    onSuccess: (_, variables) => {
      const values = form.getValues();
      const pageState: SignupVerifyPageState = {
        registration: { ...values, email: variables.email },
      };
      navigate("/signup/verify-email", { state: pageState });
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
        <SignupForm
          mode="account"
          userId={form.watch("user_id")}
          email={form.watch("email")}
          password={form.watch("password")}
          confirmPassword={form.watch("confirmPassword")}
          userIdError={form.formState.errors.user_id?.message}
          emailError={form.formState.errors.email?.message}
          passwordError={form.formState.errors.password?.message}
          confirmPasswordError={form.formState.errors.confirmPassword?.message}
          errorMessage={formatAuthError(sendOtpMutation.error instanceof Error ? sendOtpMutation.error.message : undefined)}
          isPending={sendOtpMutation.isPending}
          onUserIdChange={(value) => form.setValue("user_id", value, { shouldDirty: true, shouldValidate: true })}
          onEmailChange={(value) => form.setValue("email", value, { shouldDirty: true, shouldValidate: true })}
          onPasswordChange={(value) => form.setValue("password", value, { shouldDirty: true, shouldValidate: true })}
          onConfirmPasswordChange={(value) =>
            form.setValue("confirmPassword", value, { shouldDirty: true, shouldValidate: true })
          }
          onSubmit={() => {
            void form.handleSubmit((values) => {
              sendOtpMutation.reset();
              sendOtpMutation.mutate({ email: values.email });
            })();
          }}
        />
        </div>
      </section>
      <section className="relative hidden md:block">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=1800&q=80"
            alt="Trading dashboard cover"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-white/80">Trading Monitoring Console</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">Create your access to live futures monitoring</h2>
          <p className="mt-3 max-w-md text-sm text-white/90">
            Register your account, verify your email with OTP, and enter the real-time dashboard.
          </p>
        </div>
      </section>
    </div>
  );
}
