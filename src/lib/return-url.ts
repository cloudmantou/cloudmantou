/**
 * Keeps authentication return paths inside this application.
 *
 * Next's client router accepts a path string, so normalize this at every
 * authentication boundary instead of trusting a callback query parameter.
 */
export function normalizeInternalReturnUrl(
  value: string | null | undefined,
  fallback: string
): string {
  if (!value || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const base = new URL("https://cloudmantou.local");
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
