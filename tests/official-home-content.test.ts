import { describe, expect, it } from "vitest";
import {
  OFFICIAL_COMPATIBILITY,
  OFFICIAL_FEATURES,
  OFFICIAL_FREE_NOTICE,
  OFFICIAL_HERO,
  getOfficialHomeContent,
} from "@/config/official-home";
import { siteConfig } from "@/config/site";

describe("official homepage content", () => {
  it("keeps the three iOS compatibility promises separate", () => {
    expect(OFFICIAL_COMPATIBILITY).toEqual(
      expect.objectContaining({
        baseline: "iOS 15.0+",
        virtualLocation: "iOS 15+",
        latest: "iOS 26.4+",
      }),
    );
  });

  it("includes every requested product capability", () => {
    expect(OFFICIAL_FEATURES.map((feature) => feature.title)).toEqual([
      "App Store 应用降级",
      "虚拟定位",
      "IPA 签名",
      "免 Wi-Fi",
      "iOS 26.4+ 新系统适配",
      "香色闺阁安装",
    ]);
  });

  it("puts the free tool download before card-key purchase", () => {
    expect(OFFICIAL_HERO.title).toBe("一款免费的 iOS 设备必备工具");
    expect(OFFICIAL_HERO.primaryAction).toEqual({
      label: "获取下载方式",
      href: "/download",
    });
    expect(OFFICIAL_HERO.secondaryAction).toEqual({
      label: "购买卡密",
      href: "/pricing",
    });
    expect(siteConfig.nav[0]).toEqual({ label: "安装", value: "download", href: "/download" });
    expect(OFFICIAL_FREE_NOTICE).toContain("工具免费下载");
    expect(OFFICIAL_FREE_NOTICE).toContain("卡密权益以商品说明为准");
  });

  it("provides an English home variant with the same product contract", () => {
    const english = getOfficialHomeContent("en");

    expect(english.hero.title).toBe("A free essential toolkit for iOS devices");
    expect(english.hero.primaryAction).toEqual({ label: "Get download options", href: "/download" });
    expect(english.hero.secondaryAction).toEqual({ label: "Buy a card key", href: "/pricing" });
    expect(english.compatibility.baseline).toBe("iOS 15.0+");
    expect(english.compatibility.virtualLocation).toBe("iOS 15+");
    expect(english.features).toHaveLength(6);
  });
});
