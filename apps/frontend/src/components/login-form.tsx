import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiStatusAlert } from "@/components/ui/api-status-alert";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { useT } from "@/lib/i18n";

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
  const t = useT();
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
          <Typography as="p" variant="title" className="text-zinc-600">
            {t("auth.login.welcomeBack")}
          </Typography>
          <Typography as="h1" variant="h2" className="text-zinc-900">
            {t("auth.login.title")}
          </Typography>
          <Typography as="p" variant="body" className="text-zinc-600">
            {t("auth.login.subtitle")}
          </Typography>
        </div>
        {errorMessage ? (
          <ApiStatusAlert message={errorMessage} />
        ) : null}
        <Field data-invalid={Boolean(userIdError)}>
          <FieldLabel htmlFor="user-id">{t("auth.label.userId")}</FieldLabel>
          <Input
            id="user-id"
            className="h-10 rounded-xl"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            aria-invalid={Boolean(userIdError)}
            disabled={isPending}
          />
          <FieldError errors={userIdErrors} className="text-xs leading-3 text-red-600" />
        </Field>
        <Field data-invalid={Boolean(passwordError)}>
          <FieldLabel htmlFor="password">{t("auth.label.password")}</FieldLabel>
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
              aria-label={showPassword ? t("auth.action.hidePassword") : t("auth.action.showPassword")}
              className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900"
              onClick={() => setShowPassword((value) => !value)}
              disabled={isPending}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError
            errors={passwordErrors}
            className="text-xs leading-3 text-red-600"
          />
        </Field>
        <Field>
          <Button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {isPending ? t("auth.action.signingIn") : t("auth.action.login")}
          </Button>
        </Field>
        <Typography as="p" variant="body" className="text-center text-zinc-600">
          {t("auth.login.noAccount")}{" "}
          <Link
            to="/signup"
            className="font-medium text-zinc-900 underline underline-offset-4"
          >
            {t("auth.login.signUp")}
          </Link>
        </Typography>
      </FieldGroup>
    </form>
  );
}
