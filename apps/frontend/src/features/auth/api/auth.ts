import { postJson } from "@/lib/api/client";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  SendEmailOtpRequest,
  VerifyEmailOtpRequest,
  VerifyEmailOtpResponse,
} from "@/features/auth/api/types";

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return postJson<AuthResponse, LoginRequest>("/auth/login", payload);
}

export function sendEmailOtp(payload: SendEmailOtpRequest): Promise<{ status: string }> {
  return postJson<{ status: string }, SendEmailOtpRequest>("/auth/email/send-otp", payload);
}

export function verifyEmailOtp(payload: VerifyEmailOtpRequest): Promise<VerifyEmailOtpResponse> {
  return postJson<VerifyEmailOtpResponse, VerifyEmailOtpRequest>("/auth/email/verify-otp", payload);
}

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return postJson<AuthResponse, RegisterRequest>("/auth/register", payload);
}

export function refresh(): Promise<AuthResponse> {
  return postJson<AuthResponse, Record<string, never>>("/auth/refresh", {});
}

export function logout(): Promise<Record<string, never>> {
  return postJson<Record<string, never>, Record<string, never>>("/auth/logout", {});
}
