import type { JSX } from "react";
import { Button } from "@/components/ui/button";

interface EmailVerificationStepProps {
  email: string;
  emailError?: string;
  otpCode: string;
  disabled: boolean;
  isSending: boolean;
  isVerifying: boolean;
  hasOtpSent: boolean;
  resendCooldownSeconds: number;
  onEmailChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onSendCode: () => void;
  onVerifyCode: () => void;
}

export function EmailVerificationStep({
  email,
  emailError,
  otpCode,
  disabled,
  isSending,
  isVerifying,
  hasOtpSent,
  resendCooldownSeconds,
  onEmailChange,
  onOtpCodeChange,
  onSendCode,
  onVerifyCode,
}: EmailVerificationStepProps): JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.08em] text-subtle-foreground">Step 1: Verify email</p>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">Email</span>
        <input
          type="text"
          value={email}
          disabled={disabled}
          onChange={(event) => onEmailChange(event.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        />
        {emailError ? <span className="block text-xs text-danger">{emailError}</span> : null}
      </label>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">Verification code</span>
        <input
          type="text"
          value={otpCode}
          disabled={disabled}
          onChange={(event) => onOtpCodeChange(event.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      {hasOtpSent && resendCooldownSeconds > 0 ? (
        <p className="text-xs text-muted-foreground">You can resend a verification code in {resendCooldownSeconds} seconds.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || (hasOtpSent && resendCooldownSeconds > 0)}
          onClick={onSendCode}
        >
          {isSending
            ? "Sending..."
            : hasOtpSent
              ? resendCooldownSeconds > 0
                ? `Resend in ${resendCooldownSeconds}s`
                : "Resend code"
              : "Send code"}
        </Button>
        <Button type="button" disabled={disabled || !hasOtpSent} onClick={onVerifyCode}>
          {isVerifying ? "Verifying..." : "Verify email"}
        </Button>
      </div>
    </div>
  );
}
