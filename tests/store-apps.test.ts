import type { StoreApp } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isSupportedStoreInstallUrl,
  parseScreenshots,
  STORE_CATEGORY_LABELS,
} from "@/lib/store-apps";
import { toPublicStoreApp } from "@/lib/store-apps.server";

const app: StoreApp = {
  id: "app-1",
  name: "示例应用",
  slug: "example-app",
  tagline: "安全安装",
  description: "用于验证 Store 公共契约。",
  iconUrl: "/uploads/store/example.png",
  coverUrl: null,
  screenshots: ["/uploads/store/one.png", 7, "https://cdn.example.com/two.png"],
  category: "TOOL",
  featured: false,
  sortOrder: 1,
  published: true,
  installUrl: "mantou://store/example-app",
  minIos: "15.0",
  createdAt: new Date("2026-07-19T00:00:00.000Z"),
  updatedAt: new Date("2026-07-19T00:00:00.000Z"),
};

describe("Store 公共契约", () => {
  it("共享类型和标签不依赖 Prisma 运行时枚举", () => {
    expect(STORE_CATEGORY_LABELS).toEqual({
      READING: "阅读",
      TOOL: "工具",
      ENTERTAINMENT: "娱乐",
      OTHER: "其他",
    });
  });

  it("只保留字符串截图地址", () => {
    expect(parseScreenshots(app.screenshots)).toEqual([
      "/uploads/store/one.png",
      "https://cdn.example.com/two.png",
    ]);
  });

  it.each([
    "https://downloads.example.com/app/manifest.plist",
    "mantou://store/example-app",
    "itms-services://?action=download-manifest&url=https://downloads.example.com/app.plist",
  ])("允许受支持的安装地址：%s", (url) => {
    expect(isSupportedStoreInstallUrl(url)).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:text/html,boom", "http://example.com/app", "/download/app"])(
    "拒绝危险或不完整的安装地址：%s",
    (url) => {
      expect(isSupportedStoreInstallUrl(url)).toBe(false);
    }
  );

  it("匿名响应永不包含 installUrl", () => {
    expect(toPublicStoreApp(app)).not.toHaveProperty("installUrl");
  });

  it("有权限且配置安全地址时才返回 installUrl", () => {
    expect(toPublicStoreApp(app, true).installUrl).toBe("mantou://store/example-app");
    expect(
      toPublicStoreApp({ ...app, installUrl: "javascript:alert(1)" }, true)
    ).not.toHaveProperty("installUrl");
    expect(toPublicStoreApp({ ...app, installUrl: null }, true)).not.toHaveProperty("installUrl");
  });
});
