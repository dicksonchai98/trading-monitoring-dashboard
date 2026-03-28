import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = loginSchema
  .omit({ username: true })
  .extend({
    email: z.string().email("Email is invalid"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
    otpCode: z.string().min(1, "Verification code is required"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
