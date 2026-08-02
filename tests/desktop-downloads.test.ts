import { describe, expect, it } from "vitest";
import {
  getDesktopDownloadUrls,
  normalizeDesktopDownloadUrl,
} from "@/lib/desktop-downloads";
import { getOfficialMessages } from "@/i18n/official";

describe("desktop download configuration", () => {
  it("supports HTTPS and same-site package paths", () => {
    expect(normalizeDesktopDownloadUrl(" https://downloads.example.test/mantou.exe ")).toBe(
      "https://downloads.example.test/mantou.exe",
    );
    expect(normalizeDesktopDownloadUrl("/downloads/mantou.dmg")).toBe(
      "/downloads/mantou.dmg",
    );
  });

  it("rejects unsafe or malformed package links", () => {
    expect(normalizeDesktopDownloadUrl("http://downloads.example.test/mantou.exe")).toBeNull();
    expect(normalizeDesktopDownloadUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDesktopDownloadUrl("//evil.example/mantou.dmg")).toBeNull();
    expect(normalizeDesktopDownloadUrl("not-a-url")).toBeNull();
    expect(normalizeDesktopDownloadUrl(undefined)).toBeNull();
  });

  it("returns Windows first and macOS second from environment configuration", () => {
    expect(
      getDesktopDownloadUrls({
        windowsDownloadUrl: "https://downloads.example.test/mantou.exe",
        macosDownloadUrl: "/downloads/mantou.dmg",
      }),
    ).toEqual([
      { id: "windows", url: "https://downloads.example.test/mantou.exe" },
      { id: "macos", url: "/downloads/mantou.dmg" },
    ]);
  });

  it("publishes both desktop platforms in Chinese and English", () => {
    const chinese = getOfficialMessages("zh").pages.download;
    const english = getOfficialMessages("en").pages.download;

    expect(chinese.platforms.map((platform) => platform.id)).toEqual(["windows", "macos"]);
    expect(english.platforms.map((platform) => platform.id)).toEqual(["windows", "macos"]);
    expect(chinese.platformTitle).toContain("Windows");
    expect(chinese.platformTitle).toContain("macOS");
    expect(english.platformTitle).toContain("Windows");
    expect(english.platformTitle).toContain("macOS");
  });
});
