import { postJson } from "@/lib/api/client";
import type { AuthRequest, AuthResponse } from "@/features/auth/api/types";

export function login(payload: AuthRequest): Promise<AuthResponse> {
  return postJson<AuthResponse, AuthRequest>("/auth/login", payload);
}

export function register(payload: AuthRequest): Promise<AuthResponse> {
  return postJson<AuthResponse, AuthRequest>("/auth/register", payload);
}
