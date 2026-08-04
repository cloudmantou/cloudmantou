import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    comment: { count: vi.fn() },
    post: { update: vi.fn() },
    dailyRecordComment: { count: vi.fn() },
    dailyRecord: { update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { htmlToMarkdown } from "@/lib/html-to-markdown";
import {
  applyPostCommentCountDelta,
  commentCountDelta,
  countApprovedDailyRecordComments,
  countApprovedPostComments,
  onCommentDeleted,
  onCommentStatusChange,
  onDailyRecordCommentCreated,
  onDailyRecordCommentDeleted,
  onDailyRecordCommentStatusChange,
  reconcileDailyRecordCommentCount,
  reconcilePostCommentCount,
} from "@/lib/comment-count";

type FakeNode = {
  nodeType: number;
  textContent: string;
  tagName?: string;
  childNodes?: FakeNode[];
  children?: FakeNode[];
  className?: string;
  getAttribute?: (name: string) => string | null;
  querySelector?: (selector: string) => FakeNode | null;
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
let parsedBodyNodes: FakeNode[] = [];

class FakeNodeConstructor {
  static readonly TEXT_NODE = TEXT_NODE;
  static readonly ELEMENT_NODE = ELEMENT_NODE;
}

function text(value: string): FakeNode {
  return { nodeType: TEXT_NODE, textContent: value };
}

function comment(value: string): FakeNode {
  return { nodeType: 8, textContent: value };
}

function element(
  tag: string,
  childNodes: FakeNode[] = [],
  attributes: Record<string, string> = {}
): FakeNode {
  const node: FakeNode = {
    nodeType: ELEMENT_NODE,
    textContent: "",
    tagName: tag.toUpperCase(),
    childNodes,
    children: childNodes.filter((child) => child.nodeType === ELEMENT_NODE),
    className: attributes.class ?? "",
    getAttribute: (name) => attributes[name] ?? null,
    querySelector: (selector) => {
      const wanted = selector.toUpperCase();
      const pending = [...childNodes];
      while (pending.length > 0) {
        const candidate = pending.shift();
        if (candidate?.tagName === wanted) return candidate;
        if (candidate?.childNodes) pending.push(...candidate.childNodes);
      }
      return null;
    },
  };
  Object.defineProperty(node, "textContent", {
    get: () => childNodes.map((child) => child.textContent).join(""),
  });
  return node;
}

class FakeDOMParser {
  parseFromString() {
    return { body: { childNodes: parsedBodyNodes } };
  }
}

function createCommentTx() {
  return {
    comment: { count: vi.fn() },
    post: { update: vi.fn() },
    dailyRecordComment: { count: vi.fn() },
    dailyRecord: { update: vi.fn() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  parsedBodyNodes = [];
  vi.stubGlobal("Node", FakeNodeConstructor);
  vi.stubGlobal("DOMParser", FakeDOMParser);
});

describe("htmlToMarkdown", () => {
  it("returns an empty string without invoking the parser for blank input", () => {
    expect(htmlToMarkdown("  \n ")).toBe("");
  });

  it("converts headings, inline formatting, links, images, and breaks", () => {
    parsedBodyNodes = [
      element("h2", [text(" Hello   "), element("strong", [text("world")])]),
      element("p", [
        element("em", [text("italics")]),
        text(" "),
        element("a", [text("site")], { href: "https://example.test" }),
        text(" "),
        element("a", [text("plain")]),
        element("br"),
        element("code", [text("x")]),
        text(" "),
        element("span", [text("span")]),
        text(" "),
        element("img", [], { src: "/image.png", alt: "cover" }),
      ]),
      element("img", [], { src: "/standalone.png" }),
      element("img", [], { src: "data:image/gif;base64,placeholder", "data-src": "https://cdn.example.test/lazy.png", alt: "lazy" }),
    ];

    const markdown = htmlToMarkdown("<fixture />");

    expect(markdown).toContain("## Hello **world**");
    expect(markdown).toContain("*italics* [site](https://example.test) plain");
    expect(markdown).toContain("`x` span ![cover](/image.png)");
    expect(markdown).toContain("![image](/standalone.png)");
    expect(markdown).toContain("![lazy](https://cdn.example.test/lazy.png)");
    expect(markdown).not.toContain("data:image/gif");
  });

  it("converts code blocks, quotes, lists, rules, and fallback containers", () => {
    parsedBodyNodes = [
      element("pre", [
        element("code", [text("const value = 1;\n")], { class: "language-ts" }),
      ]),
      element("pre", [text("plain code")]),
      element("blockquote", [element("p", [text("quoted")])]),
      element("ul", [element("li", [text("one")]), element("li", [text("two")])]),
      element("ol", [element("li", [text("first")]), element("li", [text("second")])]),
      element("hr"),
      element("main", [text("tail")]),
      text(" loose text "),
      comment("ignored"),
    ];

    const markdown = htmlToMarkdown("<fixture />");

    expect(markdown).toContain("```ts\nconst value = 1;\n```");
    expect(markdown).toContain("```\nplain code\n```");
    expect(markdown).toContain("> quoted");
    expect(markdown).toContain("- one\n- two");
    expect(markdown).toContain("1. first\n2. second");
    expect(markdown).toContain("---");
    expect(markdown).toContain("tail\n\nloose text");
    expect(markdown).not.toContain("ignored");
  });

  it("drops empty elements and collapses excessive blank lines", () => {
    parsedBodyNodes = [
      element("h1"),
      element("ul"),
      element("p", [element("strong"), element("img")]),
      text("   "),
      element("div", [text("kept")]),
    ];

    expect(htmlToMarkdown("<fixture />")).toBe("kept");
  });
});

describe("post comment count helpers", () => {
  it("counts and reconciles approved comments using production query shapes", async () => {
    prismaMock.comment.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);

    await expect(countApprovedPostComments("post-1")).resolves.toBe(3);
    await expect(reconcilePostCommentCount("post-1")).resolves.toBe(4);

    expect(prismaMock.comment.count).toHaveBeenCalledWith({
      where: { postId: "post-1", status: "APPROVED" },
    });
    expect(prismaMock.post.update).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { commentCount: 4 },
    });
  });

  it("computes and applies positive, negative, and zero deltas", async () => {
    const tx = createCommentTx();

    expect(commentCountDelta("PENDING", "APPROVED")).toBe(1);
    expect(commentCountDelta("APPROVED", "REJECTED")).toBe(-1);
    expect(commentCountDelta("PENDING", "REJECTED")).toBe(0);
    await applyPostCommentCountDelta(tx as never, "post-1", 0);
    await applyPostCommentCountDelta(tx as never, "post-1", 2);
    await applyPostCommentCountDelta(tx as never, "post-1", -2);

    expect(tx.post.update).toHaveBeenNthCalledWith(1, {
      where: { id: "post-1" },
      data: { commentCount: { increment: 2 } },
    });
    expect(tx.post.update).toHaveBeenNthCalledWith(2, {
      where: { id: "post-1" },
      data: { commentCount: { decrement: 2 } },
    });
  });

  it("updates counts for status changes and approved deletions only", async () => {
    const tx = createCommentTx();

    await onCommentStatusChange(tx as never, "post-1", "PENDING", "APPROVED");
    await onCommentDeleted(tx as never, "post-1", "APPROVED");
    await onCommentDeleted(tx as never, "post-1", "REJECTED");

    expect(tx.post.update).toHaveBeenCalledTimes(2);
  });
});

describe("daily-record comment count helpers", () => {
  it("counts and reconciles approved top-level comments", async () => {
    const tx = createCommentTx();
    tx.dailyRecordComment.count.mockResolvedValueOnce(5).mockResolvedValueOnce(6);

    await expect(countApprovedDailyRecordComments("record-1", tx as never)).resolves.toBe(5);
    await expect(reconcileDailyRecordCommentCount("record-1", tx as never)).resolves.toBe(6);

    expect(tx.dailyRecordComment.count).toHaveBeenCalledWith({
      where: { recordId: "record-1", parentId: null, status: "APPROVED" },
    });
    expect(tx.dailyRecord.update).toHaveBeenCalledWith({
      where: { id: "record-1" },
      data: { commentCount: 6 },
    });
  });

  it("handles create, status-change, and delete branches", async () => {
    const tx = createCommentTx();

    await onDailyRecordCommentCreated(tx as never, "record-1", "APPROVED");
    await onDailyRecordCommentCreated(tx as never, "record-1", "PENDING");
    await onDailyRecordCommentStatusChange(
      tx as never,
      "record-1",
      "PENDING",
      "APPROVED"
    );
    await onDailyRecordCommentStatusChange(
      tx as never,
      "record-1",
      "APPROVED",
      "REJECTED"
    );
    await onDailyRecordCommentStatusChange(
      tx as never,
      "record-1",
      "PENDING",
      "REJECTED"
    );
    await onDailyRecordCommentDeleted(tx as never, "record-1", "APPROVED");
    await onDailyRecordCommentDeleted(tx as never, "record-1", "PENDING");

    expect(tx.dailyRecord.update).toHaveBeenCalledTimes(4);
    expect(tx.dailyRecord.update).toHaveBeenNthCalledWith(1, {
      where: { id: "record-1" },
      data: { commentCount: { increment: 1 } },
    });
    expect(tx.dailyRecord.update).toHaveBeenNthCalledWith(3, {
      where: { id: "record-1" },
      data: { commentCount: { decrement: 1 } },
    });
  });
});
