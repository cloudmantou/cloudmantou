export const DESKTOP_DOWNLOAD_PLATFORMS = ["windows", "macos"] as const;

export type DesktopDownloadPlatform = (typeof DESKTOP_DOWNLOAD_PLATFORMS)[number];

export type DesktopDownloadConfiguration = Readonly<{
  windowsDownloadUrl?: string;
  macosDownloadUrl?: string;
}>;

const SAME_SITE_DOWNLOAD_ORIGIN = "https://downloads.local";

export function normalizeDesktopDownloadUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    if (candidate.startsWith("/")) {
      const url = new URL(candidate, SAME_SITE_DOWNLOAD_ORIGIN);
      if (url.origin !== SAME_SITE_DOWNLOAD_ORIGIN) return null;
      return `${url.pathname}${url.search}${url.hash}`;
    }

    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getDesktopDownloadUrls(
  configuration?: DesktopDownloadConfiguration,
): ReadonlyArray<{ id: DesktopDownloadPlatform; url: string | null }> {
  const resolvedConfiguration = configuration ?? {
    windowsDownloadUrl: process.env.WINDOWS_DOWNLOAD_URL,
    macosDownloadUrl: process.env.MACOS_DOWNLOAD_URL,
  };

  return [
    {
      id: "windows",
      url: normalizeDesktopDownloadUrl(resolvedConfiguration.windowsDownloadUrl),
    },
    {
      id: "macos",
      url: normalizeDesktopDownloadUrl(resolvedConfiguration.macosDownloadUrl),
    },
  ];
}
