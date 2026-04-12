import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface LoginFormProps {
  userId: string;
  password: string;
  userIdError?: string;
  passwordError?: string;
  errorMessage?: string | null;
  isPending: boolean;
  onUserIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function LoginForm({
  userId,
  password,
  userIdError,
  passwordError,
  errorMessage,
  isPending,
  onUserIdChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const userIdErrors = userIdError ? [{ message: userIdError }] : undefined;
  const passwordErrors = passwordError
    ? [{ message: passwordError }]
    : undefined;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FieldGroup>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-600">Welcome back</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Login to your account
          </h1>
          <p className="text-sm text-zinc-600">
            Use your workspace credentials to continue.
          </p>
        </div>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-invalid={Boolean(userIdError)}>
          <FieldLabel htmlFor="user-id">User ID</FieldLabel>
          <Input
            id="user-id"
            className="h-10 rounded-xl"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            aria-invalid={Boolean(userIdError)}
            disabled={isPending}
          />
          <FieldError errors={userIdErrors} className="text-[10px] leading-3 text-red-600" />
        </Field>
        <Field data-invalid={Boolean(passwordError)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              className="h-10 rounded-xl pr-10"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              aria-invalid={Boolean(passwordError)}
              disabled={isPending}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900"
              onClick={() => setShowPassword((value) => !value)}
              disabled={isPending}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError
            errors={passwordErrors}
            className="text-[10px] leading-3 text-red-600"
          />
        </Field>
        <Field>
          <Button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {isPending ? "Signing in..." : "Login"}
          </Button>
        </Field>
        <p className="text-center text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-medium text-zinc-900 underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
