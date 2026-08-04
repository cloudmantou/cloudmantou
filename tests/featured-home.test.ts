import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorialPostCardData } from "@/components/editorial/EditorialArticleCard";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  locale: vi.fn(),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useTransition: vi.fn(),
  useCallback: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { post: { findMany: mocks.findMany } },
}));

vi.mock("@/i18n/server", () => ({ getRequestLocale: mocks.locale }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: mocks.useState,
  useEffect: mocks.useEffect,
  useTransition: mocks.useTransition,
  useCallback: mocks.useCallback,
}));

import HomePage from "@/app/page";
import AdminPostsPage from "@/app/admin/posts/page";
import { EditorialBlogHome } from "@/components/editorial/EditorialBlogHome";

type FeaturedPost = EditorialPostCardData & { isTop: boolean };
type AdminFeaturedPost = FeaturedPost & {
  id: string;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  tags: Array<{ id: string; name: string }>;
};

function makePost(
  slug: string,
  options: Partial<Pick<FeaturedPost, "isTop" | "status" | "publishedAt">> = {},
): FeaturedPost {
  return {
    slug,
    title: `Title ${slug}`,
    excerpt: `Excerpt ${slug}`,
    coverImage: null,
    publishedAt: new Date("2026-08-04T00:00:00.000Z"),
    status: "PUBLISHED",
    isTop: false,
    category: { name: "Engineering" },
    author: { username: "mantou", nickname: "馒头" },
    ...options,
  };
}

async function selectHomepagePosts(posts: FeaturedPost[]): Promise<{
  featuredPosts: FeaturedPost[];
  recentPosts: FeaturedPost[];
}> {
  const editorialFeatured = await import("@/lib/editorial-featured");
  return editorialFeatured.selectEditorialHomepagePosts(posts) as {
    featuredPosts: FeaturedPost[];
    recentPosts: FeaturedPost[];
  };
}

function collectText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && "props" in node) {
    return collectText((node as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return undefined;
  }
  if (node == null || typeof node !== "object" || !("props" in node)) return undefined;

  const element = node as ReactElement<Record<string, unknown>>;
  if (predicate(element)) return element;
  return findElement(element.props.children as ReactNode, predicate);
}

describe("featured editorial homepage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale.mockResolvedValue("zh");
    mocks.findMany.mockResolvedValue([]);
  });

  it("includes isTop in EditorialPostCardData", () => {
    const cardSource = readFileSync(
      join(process.cwd(), "src/components/editorial/EditorialArticleCard.tsx"),
      "utf8",
    );

    expect(cardSource).toMatch(
      /export type EditorialPostCardData\s*=\s*\{[\s\S]*?\bisTop\s*:\s*boolean\s*;/,
    );
  });

  it("selects isTop and uses isTop, publishedAt, and id for stable homepage ordering", async () => {
    await HomePage();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["PUBLISHED", "PAID_ONLY"] } },
        orderBy: [
          { isTop: "desc" },
          { publishedAt: "desc" },
          { id: "desc" },
        ],
        select: expect.objectContaining({ isTop: true }),
      }),
    );
  });

  it("selects at most five explicitly featured public posts and excludes them from recent posts", async () => {
    const posts = [
      makePost("draft-top", { isTop: true, status: "DRAFT" }),
      ...Array.from({ length: 6 }, (_, index) => makePost(`top-${index + 1}`, { isTop: true })),
      makePost("recent-1"),
      makePost("recent-2", { status: "PAID_ONLY" }),
    ];

    const { featuredPosts, recentPosts } = await selectHomepagePosts(posts);

    expect(featuredPosts.map((post) => post.slug)).toEqual([
      "top-1",
      "top-2",
      "top-3",
      "top-4",
      "top-5",
    ]);
    expect(recentPosts.map((post) => post.slug)).not.toEqual(
      expect.arrayContaining(featuredPosts.map((post) => post.slug)),
    );
    expect(recentPosts.map((post) => post.slug)).not.toContain("draft-top");
  });

  it("falls back to the first five public posts when no post is explicitly featured", async () => {
    const posts = [
      makePost("draft", { status: "DRAFT" }),
      ...Array.from({ length: 7 }, (_, index) => makePost(`public-${index + 1}`)),
    ];

    const { featuredPosts, recentPosts } = await selectHomepagePosts(posts);

    expect(featuredPosts.map((post) => post.slug)).toEqual([
      "public-1",
      "public-2",
      "public-3",
      "public-4",
      "public-5",
    ]);
    expect(recentPosts.map((post) => post.slug)).toEqual(["public-6", "public-7"]);
  });

  it("orders recent posts by publication time instead of leftover featured priority", async () => {
    const posts = [
      ...Array.from({ length: 5 }, (_, index) => makePost(`top-${index + 1}`, { isTop: true })),
      makePost("top-old", {
        isTop: true,
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makePost("recent-new", {
        publishedAt: new Date("2026-08-05T00:00:00.000Z"),
      }),
    ];

    const { recentPosts } = await selectHomepagePosts(posts);

    expect(recentPosts.map((post) => post.slug)).toEqual(["recent-new", "top-old"]);
  });

  it("renders localized featured-section headings on the homepage", () => {
    const posts = [makePost("featured", { isTop: true }), makePost("recent")];
    const zhText = collectText(EditorialBlogHome({ posts, locale: "zh" }));
    const enText = collectText(EditorialBlogHome({ posts, locale: "en" }));

    expect(zhText).toContain("精选长文");
    expect(zhText).toContain("先看这几篇");
    expect(enText).toContain("Featured essays");
    expect(enText).toContain("Start with these picks");
  });
});

describe("admin featured-post action", () => {
  function renderAdminPosts(post: AdminFeaturedPost) {
    const transitionPromises: Promise<unknown>[] = [];
    mocks.useState.mockImplementation((initial: unknown) => {
      if (Array.isArray(initial)) return [[post], vi.fn()];
      if (initial === true) return [false, vi.fn()];
      return [initial, vi.fn()];
    });
    mocks.useEffect.mockImplementation(() => undefined);
    mocks.useCallback.mockImplementation((callback: unknown) => callback);
    mocks.useTransition.mockReturnValue([
      false,
      (callback: () => unknown) => {
        transitionPromises.push(Promise.resolve(callback()));
      },
    ]);

    return {
      tree: AdminPostsPage(),
      waitForTransitions: () => Promise.all(transitionPromises),
    };
  }

  it.each([
    { current: false, label: "置顶", expected: true },
    { current: true, label: "取消置顶", expected: false },
  ])("offers $label and PUTs only isTop=$expected", async ({ current, label, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { tree, waitForTransitions } = renderAdminPosts({
      ...makePost("featured-admin", { isTop: current }),
      id: "post-1",
      viewCount: 0,
      commentCount: 0,
      createdAt: "2026-08-04T00:00:00.000Z",
      tags: [],
    });
    const action = findElement(
      tree,
      (element) => element.type === "button" &&
        (element.props.title === label || element.props["aria-label"] === label),
    );

    expect(action, `missing clickable ${label} action`).toBeDefined();
    const clickResult = action?.props.onClick as (() => unknown) | undefined;
    await clickResult?.();
    await waitForTransitions();

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/admin/posts/post-1" && init?.method === "PUT",
    );
    expect(putCall, `missing PUT for ${label}`).toBeDefined();
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({ isTop: expected });
  });
});
