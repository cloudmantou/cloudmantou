import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { post: { findMany: mocks.findMany } },
}));

vi.mock("@/lib/seo", () => ({
  getSeoContext: vi.fn().mockResolvedValue({
    name: "馒头",
    subtitle: "技术与产品的独立笔记",
    description: "公开技术文章",
    url: "https://cloudmantoua.top",
    locale: "zh",
  }),
  withEditorialSeoContext: (context: unknown) => context,
}));

import { GET } from "@/app/llms.txt/route";

describe("GET /llms.txt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        slug: "ios-downgrade",
        title: "iOS 应用降级",
        seoTitle: "iOS 应用降级方法与条件",
        excerpt: "文章摘要",
        seoDescription: "说明 iOS 应用降级的条件、步骤与限制。",
        updatedAt: new Date("2026-08-04T00:00:00Z"),
      },
    ]);
  });

  it("indexes only public posts and prefers their SEO description", async () => {
    const response = await GET();
    const text = await response.text();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "PUBLISHED" },
      select: expect.not.objectContaining({ paidContent: expect.anything() }),
    }));
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("[iOS 应用降级方法与条件](https://cloudmantoua.top/post/ios-downgrade)");
    expect(text).toContain("说明 iOS 应用降级的条件、步骤与限制。");
  });
});
