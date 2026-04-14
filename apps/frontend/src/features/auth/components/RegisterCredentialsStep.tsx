import type { JSX } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
}: RegisterCredentialsStepProps): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="space-y-4">
      <p className="typo-overline text-subtle-foreground">Step 2: Create account</p>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">User ID</span>
        <input
          type="text"
          value={userId}
          disabled={disabled}
          onChange={(event) => onUserIdChange(event.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-shell px-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        />
        {userIdError ? <span className="block text-xs text-red-600">{userIdError}</span> : null}
      </label>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            disabled={disabled}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-shell px-3 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground hover:border-border-strong focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide secret input" : "Show secret input"}
            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordError ? <span className="block text-xs text-red-600">{passwordError}</span> : null}
      </label>
      <label className="space-y-2 text-sm text-foreground">
        <span className="block">Confirm password</span>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            disabled={disabled}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            className="h-10 w-full rounded-sm border border-border bg-shell px-3 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground hover:border-border-strong focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            aria-label={showConfirmPassword ? "Hide confirm secret input" : "Show confirm secret input"}
            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowConfirmPassword((value) => !value)}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPasswordError ? <span className="block text-xs text-red-600">{confirmPasswordError}</span> : null}
      </label>
      <div className="grid grid-cols-1 gap-2">
        <Button type="submit" disabled={disabled}>
          {isRegistering ? "Registering..." : "Register"}
        </Button>
      </div>
    </div>
  );
}
