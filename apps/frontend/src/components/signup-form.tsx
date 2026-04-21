import { useState, type JSX } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiStatusAlert } from "@/components/ui/api-status-alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Typography } from "@/components/ui/typography";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

interface SignupAccountFormProps {
  mode: "account";
  userId: string;
  email: string;
  password: string;
  confirmPassword: string;
  userIdError?: string;
  emailError?: string;
  passwordError?: string;
  confirmPasswordError?: string;
  errorMessage?: string | null;
  isPending: boolean;
  onUserIdChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

interface SignupVerifyFormProps {
  mode: "verify";
  email: string;
  otpCode: string;
  errorMessage?: string | null;
  resendCooldownSeconds: number;
  isSending: boolean;
  isVerifying: boolean;
  onOtpCodeChange: (value: string) => void;
  onResendCode: () => void;
  onVerifyAndCreate: () => void;
}

type SignupFormProps = SignupAccountFormProps | SignupVerifyFormProps;

function SignupStepIndicator({
  currentStep,
}: {
  currentStep: 1 | 2;
}): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2.5 rounded-full border",
            currentStep >= 1
              ? "border-red-500 bg-red-500"
              : "border-border bg-background",
          )}
        />
        <span
          className={cn(
            "h-px flex-1",
            currentStep >= 2 ? "bg-red-500" : "bg-border",
          )}
        />
        <span
          className={cn(
            "size-2.5 rounded-full border",
            currentStep >= 2
              ? "border-red-500 bg-red-500"
              : "border-border bg-background",
          )}
        />
      </div>
      <div className="flex justify-between text-xs leading-3 text-zinc-500">
        <span>{t("auth.signup.step1")}</span>
        <span>{t("auth.signup.step2")}</span>
      </div>
    </div>
  );
}

export function SignupForm(props: SignupFormProps): JSX.Element {
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (props.mode === "verify") {
    const isBusy = props.isSending || props.isVerifying;
    return (
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          props.onVerifyAndCreate();
        }}
      >
        <FieldGroup>
          <SignupStepIndicator currentStep={2} />
          <div className="flex flex-col gap-2">
            <Typography as="p" variant="title" className="text-zinc-600">
              {t("auth.verify.almostDone")}
            </Typography>
            <Typography as="h1" variant="h2" className="text-zinc-900">
              {t("auth.verify.title")}
            </Typography>
            <Typography as="p" variant="body" className="text-zinc-600">
              {t("auth.verify.subtitle", { email: props.email })}
            </Typography>
          </div>
          {props.errorMessage ? (
            <ApiStatusAlert message={props.errorMessage} />
          ) : null}
          <Field>
            <FieldLabel htmlFor="verification-code" className="text-zinc-800">
              {t("auth.label.verificationCode")}
            </FieldLabel>
            <InputOTP
              id="verification-code"
              maxLength={6}
              value={props.otpCode}
              onChange={props.onOtpCodeChange}
              aria-label={t("auth.label.verificationCode")}
              disabled={isBusy}
              containerClassName="justify-center"
              className="text-zinc-900"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </Field>
          <Field>
            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                disabled={isBusy || props.otpCode.trim().length !== 6}
                className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              >
                {props.isVerifying
                  ? t("auth.verify.verifying")
                  : t("auth.verify.cta")}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={props.onResendCode}
                disabled={isBusy || props.resendCooldownSeconds > 0}
                className="h-10 rounded-xl border-zinc-300 text-white hover:bg-zinc-800"
              >
                {props.isSending
                  ? t("auth.verify.sending")
                  : props.resendCooldownSeconds > 0
                    ? t("auth.verify.resendIn", { seconds: props.resendCooldownSeconds })
                    : t("auth.verify.resend")}
              </Button>
            </div>
          </Field>
          <Typography as="p" variant="body" className="text-center text-zinc-600">
            {t("auth.verify.editAccount")}{" "}
            <Link
              to="/signup"
              className="font-medium text-zinc-900 underline underline-offset-4"
            >
              {t("auth.verify.backToSignup")}
            </Link>
          </Typography>
        </FieldGroup>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <FieldGroup>
        <SignupStepIndicator currentStep={1} />
        <div className="flex flex-col gap-2">
          <Typography as="p" variant="title" className="text-zinc-600">
            {t("auth.signup.newAccount")}
          </Typography>
          <Typography as="h1" variant="h2" className="text-zinc-900">
            {t("auth.signup.title")}
          </Typography>
          <Typography as="p" variant="body" className="text-zinc-600">
            {t("auth.signup.subtitle")}
          </Typography>
        </div>
        {props.errorMessage ? (
          <ApiStatusAlert message={props.errorMessage} />
        ) : null}
        <Field data-invalid={Boolean(props.userIdError)}>
          <FieldLabel htmlFor="signup-user-id">{t("auth.label.userId")}</FieldLabel>
          <Input
            id="signup-user-id"
            className="h-10 rounded-xl"
            value={props.userId}
            placeholder={t("auth.placeholder.userIdRule")}
            onChange={(event) => props.onUserIdChange(event.target.value)}
            aria-invalid={Boolean(props.userIdError)}
            disabled={props.isPending}
          />
          <FieldError
            errors={
              props.userIdError ? [{ message: props.userIdError }] : undefined
            }
            className="text-xs leading-3 text-red-600"
          />
        </Field>
        <Field data-invalid={Boolean(props.emailError)}>
          <FieldLabel htmlFor="signup-email">{t("auth.label.email")}</FieldLabel>
          <Input
            id="signup-email"
            type="email"
            className="h-10 rounded-xl"
            value={props.email}
            placeholder={t("auth.placeholder.email")}
            onChange={(event) => props.onEmailChange(event.target.value)}
            aria-invalid={Boolean(props.emailError)}
            disabled={props.isPending}
          />
          <FieldError
            errors={
              props.emailError ? [{ message: props.emailError }] : undefined
            }
            className="text-xs leading-3 text-red-600"
          />
        </Field>
        <Field data-invalid={Boolean(props.passwordError)}>
          <FieldLabel htmlFor="signup-password">{t("auth.label.password")}</FieldLabel>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              className="h-10 rounded-xl pr-10"
              value={props.password}
              placeholder={t("auth.placeholder.registerPasswordRule")}
              onChange={(event) => props.onPasswordChange(event.target.value)}
              aria-invalid={Boolean(props.passwordError)}
              disabled={props.isPending}
            />
            <button
              type="button"
              aria-label={showPassword ? t("auth.action.hidePassword") : t("auth.action.showPassword")}
              className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900"
              onClick={() => setShowPassword((value) => !value)}
              disabled={props.isPending}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError
            errors={
              props.passwordError
                ? [{ message: props.passwordError }]
                : undefined
            }
            className="text-xs leading-3 text-red-600"
          />
        </Field>
        <Field data-invalid={Boolean(props.confirmPasswordError)}>
          <FieldLabel htmlFor="signup-confirm-password">
            {t("auth.label.confirmPassword")}
          </FieldLabel>
          <div className="relative">
            <Input
              id="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              className="h-10 rounded-xl pr-10"
              value={props.confirmPassword}
              placeholder={t("auth.placeholder.confirmPassword")}
              onChange={(event) =>
                props.onConfirmPasswordChange(event.target.value)
              }
              aria-invalid={Boolean(props.confirmPasswordError)}
              disabled={props.isPending}
            />
            <button
              type="button"
              aria-label={
                showConfirmPassword ? t("auth.action.hideConfirmPassword") : t("auth.action.showConfirmPassword")
              }
              className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900"
              onClick={() => setShowConfirmPassword((value) => !value)}
              disabled={props.isPending}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError
            errors={
              props.confirmPasswordError
                ? [{ message: props.confirmPasswordError }]
                : undefined
            }
            className="text-xs leading-3 text-red-600"
          />
        </Field>
        <Field>
          <Button
            type="submit"
            disabled={props.isPending}
            className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {t("auth.signup.continue")}
          </Button>
        </Field>
        <Typography as="p" variant="body" className="text-center text-zinc-600">
          {t("auth.signup.hasAccount")}{" "}
          <Link
            to="/login"
            className="font-medium text-zinc-900 underline underline-offset-4"
          >
            {t("auth.signup.signIn")}
          </Link>
        </Typography>
      </FieldGroup>
    </form>
  );
}
