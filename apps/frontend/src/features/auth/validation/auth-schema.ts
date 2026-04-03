import { z } from "zod";

export const loginSchema = z.object({
  user_id: z.string().min(3, "User ID is required"),
  password: z.string().min(8, "Password is required"),
});

export const registerSchema = z.object({
  user_id: z.string().min(3, "User ID is required"),
  email: z.string().email("Email is invalid"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
})
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
