import { describe, expect, it } from "vitest";
import {
  OFFICIAL_LOCALE_COOKIE,
  buildOfficialRewriteUrl,
  getOfficialMessages,
  getOfficialLocaleFromPath,
  isOfficialPublicPath,
  localizeOfficialPath,
  parseOfficialLocaleCookie,
  resolveOfficialRequest,
  resolveRoutedOfficialRequest,
  resolveOfficialLocale,
  stripOfficialLocalePrefix,
} from "@/i18n/official";

describe("official-site locale resolution", () => {
  it("prefers an explicit locale cookie over the browser language", () => {
    expect(
      resolveOfficialLocale({
        cookieHeader: `${OFFICIAL_LOCALE_COOKIE}=en`,
        acceptLanguage: "zh-CN,zh;q=0.9",
      })
    ).toBe("en");
    expect(parseOfficialLocaleCookie(`${OFFICIAL_LOCALE_COOKIE}=zh; theme=dark`)).toBe("zh");
    expect(parseOfficialLocaleCookie(`${OFFICIAL_LOCALE_COOKIE}=%E0%A4%A`)).toBeNull();
  });

  it("selects English or Chinese from weighted Accept-Language values", () => {
    expect(resolveOfficialLocale({ acceptLanguage: "en-US,en;q=0.9,zh;q=0.6" })).toBe("en");
    expect(resolveOfficialLocale({ acceptLanguage: "en;q=0.4,zh-CN;q=0.9" })).toBe("zh");
    expect(resolveOfficialLocale({ acceptLanguage: "fr-FR,ja;q=0.8" })).toBe("zh");
  });

  it("ships complete core copy for both locales with iOS 15 as the minimum", () => {
    const zh = getOfficialMessages("zh");
    const en = getOfficialMessages("en");

    expect(zh.site.description).toContain("iOS 15.0");
    expect(en.site.description).toContain("iOS 15.0");
    expect(zh.nav.features).toBe("功能");
    expect(en.nav.features).toBe("Features");
    expect(en.language.current).toBe("EN");
    expect(zh.language.current).toBe("中");
    expect(zh.home.compatibility.virtualLocation).toBe("iOS 15+");
    expect(en.home.compatibility.virtualLocation).toBe("iOS 15+");
    expect(JSON.stringify(zh)).not.toMatch(/iOS ?18/i);
    expect(JSON.stringify(en)).not.toMatch(/iOS ?18/i);
  });

  it("maps public routes to stable Chinese and English canonical paths", () => {
    expect(getOfficialLocaleFromPath("/en")).toBe("en");
    expect(getOfficialLocaleFromPath("/en/features")).toBe("en");
    expect(getOfficialLocaleFromPath("/features")).toBeNull();
    expect(stripOfficialLocalePrefix("/en")).toBe("/");
    expect(stripOfficialLocalePrefix("/en/store/xiangse?from=home#install")).toBe(
      "/store/xiangse?from=home#install"
    );
    expect(localizeOfficialPath("/features?from=nav#top", "en")).toBe(
      "/en/features?from=nav#top"
    );
    expect(localizeOfficialPath("/en/features?from=nav#top", "zh")).toBe(
      "/features?from=nav#top"
    );
    expect(localizeOfficialPath("/", "en")).toBe("/en");
    expect(localizeOfficialPath("/en", "zh")).toBe("/");
  });

  it("localizes only public website paths and refuses protected boundaries", () => {
    for (const path of ["/", "/features", "/download", "/docs", "/pricing", "/store/app", "/blog", "/post/mantou-assistant", "/category/news", "/tag/ios", "/login", "/register"]) {
      expect(isOfficialPublicPath(path)).toBe(true);
    }

    expect(localizeOfficialPath("/post/mantou-assistant", "en")).toBe(
      "/en/post/mantou-assistant"
    );
    expect(localizeOfficialPath("/category/news", "en")).toBe("/en/category/news");
    expect(localizeOfficialPath("/tag/ios", "en")).toBe("/en/tag/ios");

    for (const path of ["/api/products", "/admin", "/dashboard", "/payment/result", "/maintenance", "/_next/static/app.js"]) {
      expect(isOfficialPublicPath(path)).toBe(false);
      expect(localizeOfficialPath(path, "en")).toBe(path);
    }
  });

  it("redirects first-time English requests once and rewrites explicit English URLs", () => {
    expect(resolveOfficialRequest({ pathname: "/features", acceptLanguage: "en-US" })).toEqual({
      locale: "en",
      redirectPath: "/en/features",
      rewritePath: null,
      persistLocale: null,
    });
    expect(resolveOfficialRequest({ pathname: "/features", cookieHeader: `${OFFICIAL_LOCALE_COOKIE}=zh`, acceptLanguage: "en-US" })).toEqual({
      locale: "zh",
      redirectPath: null,
      rewritePath: null,
      persistLocale: null,
    });
    expect(resolveOfficialRequest({ pathname: "/en/features", cookieHeader: `${OFFICIAL_LOCALE_COOKIE}=zh` })).toEqual({
      locale: "en",
      redirectPath: null,
      rewritePath: "/features",
      persistLocale: "en",
    });
    expect(resolveOfficialRequest({ pathname: "/api/products", acceptLanguage: "en-US" })).toEqual({
      locale: null,
      redirectPath: null,
      rewritePath: null,
      persistLocale: null,
    });
    expect(resolveOfficialRequest({ pathname: "/features", method: "POST", acceptLanguage: "en-US" })).toEqual({
      locale: null,
      redirectPath: null,
      rewritePath: null,
      persistLocale: null,
    });
  });

  it("keeps locale rewrites on the incoming origin instead of re-entering an internal host", () => {
    const rewritten = buildOfficialRewriteUrl(
      "https://cloudmantoua.top/en/blog?from=nav",
      "/blog"
    );

    expect(rewritten.toString()).toBe("https://cloudmantoua.top/blog?from=nav");
  });

  it("inherits the locale exactly once for an internal rewrite", () => {
    expect(resolveRoutedOfficialRequest("en", "1")).toEqual({
      locale: "en",
      redirectPath: null,
      rewritePath: null,
      persistLocale: null,
    });
    expect(resolveRoutedOfficialRequest("en", null)).toBeNull();
    expect(resolveRoutedOfficialRequest("fr", "1")).toBeNull();
  });
});
