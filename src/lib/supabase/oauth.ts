export const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_REQUEST_TIMEOUT_MS = 15000;

export function getSafeAuthNextPath(next: string | null | undefined, fallback = DEFAULT_AUTH_REDIRECT_PATH) {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function getAuthRedirectOrigin(origin: string, configuredSiteUrl?: string | null) {
  if (isLocalAuthOrigin(origin)) return origin;
  return configuredSiteUrl?.trim() || origin;
}

export function buildAuthCallbackUrl(input: {
  origin: string;
  configuredSiteUrl?: string | null;
  nextPath?: string | null;
}) {
  const redirectOrigin = getAuthRedirectOrigin(input.origin, input.configuredSiteUrl);
  const safeNext = getSafeAuthNextPath(input.nextPath);
  return `${redirectOrigin}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(safeNext)}`;
}

export async function withAuthTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function isLocalAuthOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
