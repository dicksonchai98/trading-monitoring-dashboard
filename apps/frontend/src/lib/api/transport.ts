const ABSOLUTE_HTTP_PATTERN = /^http:\/\//i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLoopbackHttpUrl(apiBaseUrl: string): boolean {
  if (!ABSOLUTE_HTTP_PATTERN.test(apiBaseUrl)) {
    return false;
  }

  try {
    const parsed = new URL(apiBaseUrl);
    return LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function shouldBlockInsecureTransport(
  apiBaseUrl: string,
  pageProtocol: string | undefined,
  isProduction: boolean,
): boolean {
  if (!ABSOLUTE_HTTP_PATTERN.test(apiBaseUrl)) {
    return false;
  }

  if (isLoopbackHttpUrl(apiBaseUrl)) {
    return false;
  }

  return pageProtocol === "https:" || isProduction;
}
