import type { JSX } from "react";
import { Button } from "@/components/ui/button";

interface RegisterCredentialsStepProps {
  userId: string;
  password: string;
  confirmPassword: string;
  userIdError?: string;
  passwordError?: string;
  confirmPasswordError?: string;
  disabled: boolean;
  isRegistering: boolean;
  onUserIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onBack: () => void;
}

export function RegisterCredentialsStep({
  userId,
  password,
  confirmPassword,
  userIdError,
  passwordError,
  confirmPasswordError,
  disabled,
  isRegistering,
  onUserIdChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onBack,
}: RegisterCredentialsStepProps): JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.08em] text-subtle-foreground">Step 2: Create account</p>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">User ID</span>
        <input
          type="text"
          value={userId}
          disabled={disabled}
          onChange={(event) => onUserIdChange(event.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        />
        {userIdError ? <span className="block text-xs text-danger">{userIdError}</span> : null}
      </label>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">Password</span>
        <input
          type="password"
          value={password}
          disabled={disabled}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        />
        {passwordError ? <span className="block text-xs text-danger">{passwordError}</span> : null}
      </label>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          disabled={disabled}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        />
        {confirmPasswordError ? <span className="block text-xs text-danger">{confirmPasswordError}</span> : null}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={disabled}>
          {isRegistering ? "Registering..." : "Register"}
        </Button>
      </div>
    </div>
  );
}
