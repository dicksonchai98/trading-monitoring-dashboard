import { useState, type JSX } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
      <div className="flex justify-between text-[10px] leading-3 text-zinc-500">
        <span>Step 1: Account</span>
        <span>Step 2: Verify</span>
      </div>
    </div>
  );
}

export function SignupForm(props: SignupFormProps): JSX.Element {
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
            <p className="text-sm font-medium text-zinc-600">Almost done</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Verify your email
            </h1>
            <p className="text-sm text-zinc-600">
              Enter the 6-digit code sent to {props.email}.
            </p>
          </div>
          {props.errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{props.errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="verification-code" className="text-zinc-800">
              Verification code
            </FieldLabel>
            <InputOTP
              id="verification-code"
              maxLength={6}
              value={props.otpCode}
              onChange={props.onOtpCodeChange}
              aria-label="Verification code"
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
                  ? "Verifying..."
                  : "Verify and Create Account"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={props.onResendCode}
                disabled={isBusy || props.resendCooldownSeconds > 0}
                className="h-10 rounded-xl border-zinc-300 text-white hover:bg-zinc-800"
              >
                {props.isSending
                  ? "Sending..."
                  : props.resendCooldownSeconds > 0
                    ? `Resend code in ${props.resendCooldownSeconds}s`
                    : "Resend code"}
              </Button>
            </div>
          </Field>
          <div className="text-center text-sm text-zinc-600">
            Need to edit account details?{" "}
            <Link
              to="/signup"
              className="font-medium text-zinc-900 underline underline-offset-4"
            >
              Back to signup
            </Link>
          </div>
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
          <p className="text-sm font-medium text-zinc-600">New account</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Create your account
          </h1>
          <p className="text-sm text-zinc-600">
            Fill in your account details, then continue to email verification.
          </p>
        </div>
        {props.errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{props.errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(props.userIdError)}>
          <FieldLabel htmlFor="signup-user-id">User ID</FieldLabel>
          <Input
            id="signup-user-id"
            className="h-10 rounded-xl"
            value={props.userId}
            onChange={(event) => props.onUserIdChange(event.target.value)}
            aria-invalid={Boolean(props.userIdError)}
            disabled={props.isPending}
          />
          <FieldError
            errors={
              props.userIdError ? [{ message: props.userIdError }] : undefined
            }
            className="text-[10px] leading-3 text-red-600"
          />
        </Field>
        <Field data-invalid={Boolean(props.emailError)}>
          <FieldLabel htmlFor="signup-email">Email</FieldLabel>
          <Input
            id="signup-email"
            type="email"
            className="h-10 rounded-xl"
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
            aria-invalid={Boolean(props.emailError)}
            disabled={props.isPending}
          />
          <FieldError
            errors={
              props.emailError ? [{ message: props.emailError }] : undefined
            }
            className="text-[10px] leading-3 text-red-600"
          />
        </Field>
        <Field data-invalid={Boolean(props.passwordError)}>
          <FieldLabel htmlFor="signup-password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              className="h-10 rounded-xl pr-10"
              value={props.password}
              onChange={(event) => props.onPasswordChange(event.target.value)}
              aria-invalid={Boolean(props.passwordError)}
              disabled={props.isPending}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
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
            className="text-[10px] leading-3 text-red-600"
          />
        </Field>
        <Field data-invalid={Boolean(props.confirmPasswordError)}>
          <FieldLabel htmlFor="signup-confirm-password">
            Confirm Password
          </FieldLabel>
          <div className="relative">
            <Input
              id="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              className="h-10 rounded-xl pr-10"
              value={props.confirmPassword}
              onChange={(event) =>
                props.onConfirmPasswordChange(event.target.value)
              }
              aria-invalid={Boolean(props.confirmPasswordError)}
              disabled={props.isPending}
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? "Hide confirm secret" : "Show confirm secret"}
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
            className="text-[10px] leading-3 text-red-600"
          />
        </Field>
        <Field>
          <Button
            type="submit"
            disabled={props.isPending}
            className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
          >
            Continue to Email Verification
          </Button>
        </Field>
        <p className="text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-zinc-900 underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
