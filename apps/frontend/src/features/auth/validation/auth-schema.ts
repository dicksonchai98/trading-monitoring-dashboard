import { z } from "zod";

type TFn = (key: string, variables?: Record<string, string | number>) => string;

// Base schemas used only for type inference (no messages)
const baseLoginSchema = z.object({
  user_id: z.string().min(3),
  password: z.string().min(8),
});

const baseRegisterSchema = z
  .object({
    user_id: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof baseLoginSchema>;
export type RegisterFormValues = z.infer<typeof baseRegisterSchema>;

// Factory functions that produce schemas with localized messages
export function createLoginSchema(t: TFn) {
  return z.object({
    user_id: z.string().min(3, t("auth.validation.user_id_required")),
    password: z.string().min(8, t("auth.validation.password_required")),
  });
}

export function createRegisterSchema(t: TFn) {
  return z
    .object({
      user_id: z.string().min(3, t("auth.validation.user_id_required")),
      email: z.string().email(t("auth.validation.email_invalid")),
      password: z
        .string()
        .min(8, t("auth.validation.password_min_chars"))
        .regex(/[A-Z]/, t("auth.validation.password_uppercase"))
        .regex(/[a-z]/, t("auth.validation.password_lowercase"))
        .regex(/[0-9]/, t("auth.validation.password_number")),
      confirmPassword: z.string().min(1, t("auth.validation.confirm_password_required")),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: t("auth.validation.passwords_mismatch"),
      path: ["confirmPassword"],
    });
}
