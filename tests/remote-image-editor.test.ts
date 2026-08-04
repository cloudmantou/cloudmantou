import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractRemoteImageUrls,
  replaceImportedImageUrls,
} from "@/lib/markdown-remote-images";
import { importRemoteImagesInMarkdown } from "@/lib/remote-image-client";

const markdown = [
  "![hero](https://cdn.example.test/hero.png)",
  "![duplicate](https://cdn.example.test/hero.png)",
  "![legacy](http://legacy.example.test/legacy.jpg)",
  "![local](/uploads/2026/08/local.webp)",
  "![relative](./relative.png)",
  "![inline](data:image/png;base64,AAAA)",
  "[normal link](https://cdn.example.test/not-an-image.png)",
].join("\n\n");

describe("remote Markdown images", () => {
  it("extracts unique HTTP(S) image URLs but excludes local, relative, data, and normal links", () => {
    expect(extractRemoteImageUrls(markdown)).toEqual([
      "https://cdn.example.test/hero.png",
      "http://legacy.example.test/legacy.jpg",
    ]);
  });

  it("replaces every imported image occurrence while preserving failed and non-image links", () => {
    const next = replaceImportedImageUrls(markdown, [
      {
        sourceUrl: "https://cdn.example.test/hero.png",
        status: "imported",
        url: "/uploads/2026/08/hero.webp",
      },
      {
        sourceUrl: "http://legacy.example.test/legacy.jpg",
        status: "failed",
        reason: "UNSAFE_URL",
      },
    ]);

    expect(next.match(/\/uploads\/2026\/08\/hero\.webp/g)).toHaveLength(2);
    expect(next).toContain("![legacy](http://legacy.example.test/legacy.jpg)");
    expect(next).toContain("[normal link](https://cdn.example.test/not-an-image.png)");
  });
});

describe("editor remote-image client orchestration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts unique pasted image URLs as one content-image import batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: "ok",
          data: {
            items: [
              {
                sourceUrl: "https://cdn.example.test/hero.png",
                status: "imported",
                url: "/uploads/2026/08/hero.webp",
                width: 1200,
                height: 675,
                originalBytes: 4096,
                compressedBytes: 1024,
                compressionRatio: 75,
              },
              {
                sourceUrl: "http://legacy.example.test/legacy.jpg",
                status: "failed",
                reason: "UNSAFE_URL",
              },
            ],
            importedCount: 1,
            failedCount: 1,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await importRemoteImagesInMarkdown(markdown, "content");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/images/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [
          "https://cdn.example.test/hero.png",
          "http://legacy.example.test/legacy.jpg",
        ],
        purpose: "content",
      }),
    });
    expect(result.markdown.match(/\/uploads\/2026\/08\/hero\.webp/g)).toHaveLength(2);
    expect(result.markdown).toContain("![legacy](http://legacy.example.test/legacy.jpg)");
    expect(result).toMatchObject({ importedCount: 1, failedCount: 1 });
  });

  it("returns original Markdown when the batch request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await importRemoteImagesInMarkdown(markdown, "content");

    expect(result.markdown).toBe(markdown);
    expect(result).toMatchObject({ importedCount: 0, failedCount: 2 });
  });

  it("inserts rich text immediately, then replaces imported URLs without stale cursor writes", () => {
    const editor = readFileSync("src/components/admin/PostEditor.tsx", "utf8");

    expect(editor).toMatch(
      /const md = htmlToMarkdown\(html\)[\s\S]*insertText\(`\$\{md\}\\n\\n`, pos\)[\s\S]*await importRemoteImagesInMarkdown\(md,\s*["']content["']\)[\s\S]*setContent\(\(current\)\s*=>[\s\S]*replaceImportedImageUrls/,
    );
  });

  it("uses an immediate placeholder for pasted screenshots", () => {
    const editor = readFileSync("src/components/admin/PostEditor.tsx", "utf8");

    expect(editor).toMatch(
      /if \(imageFile\)[\s\S]*insertText\(`\\n\$\{placeholder\}\\n\\n`, pos\)[\s\S]*await uploadImageFile\(imageFile\)[\s\S]*setContent\(\(current\)\s*=>[\s\S]*current\.replace\(placeholder/,
    );
  });
});
