import type { UserRole } from "@/lib/types/auth";

interface AccessTokenPayload {
  sub?: unknown;
  user_id?: unknown;
  role?: unknown;
  exp?: unknown;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

export function decodeAccessToken(token: string): AccessTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_access_token");
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as AccessTokenPayload;
  } catch {
    throw new Error("invalid_access_token");
  }
}

export function mapTokenRole(role: unknown): UserRole {
  if (role === "admin") {
    return "admin";
  }
  if (role === "user") {
    return "member";
  }
  throw new Error("unsupported_role");
}
