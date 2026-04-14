export type CardDataStatus = "loading" | "error" | "empty" | "ready";

interface ResolveCardDataStatusParams {
  loading: boolean;
  error: string | null;
  hasData: boolean;
}

export function resolveCardDataStatus({
  loading,
  error,
  hasData,
}: ResolveCardDataStatusParams): CardDataStatus {
  if (loading) {
    return "loading";
  }

  if (error) {
    return "error";
  }

  if (!hasData) {
    return "empty";
  }

  return "ready";
}

