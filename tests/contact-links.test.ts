import { describe, expect, it } from "vitest";
import {
  getPublicContactLinks,
  parseContactLinks,
  sanitizeContactLink,
  serializeContactLinks,
} from "@/lib/contact-links";

describe("contact-links", () => {
  it("parses and sanitizes valid links", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        kind: "telegram",
        label: "TG群",
        enabled: true,
        sortOrder: 0,
        href: "https://t.me/example",
      },
      {
        id: "b",
        kind: "email",
        label: "邮箱",
        enabled: true,
        sortOrder: 1,
        href: "hello@example.com",
      },
    ]);

    const links = parseContactLinks(raw);
    expect(links).toHaveLength(2);
    expect(links[1].href).toBe("mailto:hello@example.com");
  });

  it("rejects javascript links and unsafe images", () => {
    const link = sanitizeContactLink(
      {
        id: "x",
        kind: "custom",
        label: "坏链",
        enabled: true,
        sortOrder: 0,
        href: "javascript:alert(1)",
        iconUrl: "javascript:alert(1)",
        qrImageUrl: "/uploads/ok.webp",
      },
      0
    );

    expect(link?.href).toBeUndefined();
    expect(link?.iconUrl).toBeUndefined();
    expect(link?.qrImageUrl).toBe("/uploads/ok.webp");
  });

  it("returns only enabled links for public API", () => {
    const links = parseContactLinks(
      serializeContactLinks([
        {
          id: "1",
          kind: "github",
          label: "GitHub",
          enabled: false,
          sortOrder: 0,
          href: "https://github.com/cloudmantou",
        },
        {
          id: "2",
          kind: "wechat",
          label: "微信",
          enabled: true,
          sortOrder: 1,
          qrImageUrl: "/uploads/wechat-qr.webp",
        },
      ])
    );

    expect(getPublicContactLinks(links)).toHaveLength(1);
    expect(getPublicContactLinks(links)[0].label).toBe("微信");
  });
});