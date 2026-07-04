import { describe, expect, it } from "vitest";
import {
  isSafeAvatarSrc,
  isSafeCoverImageUrl,
  isSafeExternalHref,
  isSafeMarkdownImageSrc,
} from "@/lib/safe-image-url";
import { resolveUploadRoot } from "@/lib/local-storage";
import path from "path";
import { isValidAlipayTradeNo } from "@/lib/payment";
import { normalizeTagSlug } from "@/lib/tag-slug";

describe("isSafeMarkdownImageSrc", () => {
  it("allows /uploads paths and https", () => {
    expect(isSafeMarkdownImageSrc("/uploads/2026/07/a.webp")).toBe(true);
    expect(isSafeMarkdownImageSrc("https://cdn.example.com/a.webp")).toBe(true);
  });

  it("rejects javascript and data URLs", () => {
    expect(isSafeMarkdownImageSrc("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkdownImageSrc("data:image/png;base64,abc")).toBe(false);
  });
});

describe("isSafeAvatarSrc", () => {
  it("only allows /uploads paths", () => {
    expect(isSafeAvatarSrc("/uploads/2026/07/avatar.webp")).toBe(true);
    expect(isSafeAvatarSrc("https://evil.example/a.png")).toBe(false);
    expect(isSafeAvatarSrc("http://internal.local/a.png")).toBe(false);
  });
});

describe("isSafeCoverImageUrl", () => {
  it("rejects SVG data URLs", () => {
    expect(isSafeCoverImageUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe(false);
    expect(isSafeCoverImageUrl("data:image/png;base64,abc")).toBe(true);
  });
});

describe("isSafeExternalHref", () => {
  it("rejects javascript links", () => {
    expect(isSafeExternalHref("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalHref("https://example.com")).toBe(true);
  });
});

describe("resolveUploadRoot", () => {
  it("rejects paths with ..", () => {
    expect(() => resolveUploadRoot("../etc")).toThrow(/must not contain/);
  });

  it("allows default public/uploads under cwd", () => {
    const root = resolveUploadRoot();
    expect(root).toBe(path.resolve(process.cwd(), "public", "uploads"));
  });
});

describe("isValidAlipayTradeNo", () => {
  it("accepts 16-28 alphanumeric trade numbers", () => {
    expect(isValidAlipayTradeNo("202507041234567890")).toBe(true);
    expect(isValidAlipayTradeNo("short")).toBe(false);
  });
});

describe("normalizeTagSlug", () => {
  it("strips non-alphanumeric characters", () => {
    expect(normalizeTagSlug("#Hello World")).toBe("hello-world");
    expect(normalizeTagSlug("标签")).toBe("");
  });
});