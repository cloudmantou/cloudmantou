import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorialCss = readFileSync("src/styles/editorial-blog.css", "utf8");
const officialCss = readFileSync("src/styles/official.css", "utf8");
const globalCss = readFileSync("src/app/globals.css", "utf8");
const markdownRenderer = readFileSync("src/components/blog/MarkdownRenderer.tsx", "utf8");
const postContent = readFileSync("src/app/post/[slug]/PostContent.tsx", "utf8");

describe("mobile editorial image stability", () => {
  it("reserves deterministic media space before cover images load", () => {
    expect(editorialCss).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.editorial-feature-grid \.editorial-article-featured-lead,[\s\S]*?grid-template-rows:\s*220px minmax\(220px, auto\)/
    );
    expect(editorialCss).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.editorial-article-lead \.editorial-article-media\s*\{[^}]*min-height:\s*210px/
    );
    expect(editorialCss).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.editorial-article-card\s*\{[^}]*grid-template-rows:\s*150px minmax\(190px, auto\)/
    );
  });

  it("limits translating hover effects to precise hover devices", () => {
    expect(editorialCss).not.toMatch(
      /\.editorial-article-item\s*\{[^}]*\}\s*\.editorial-article:hover\s*\{/
    );
    expect(editorialCss).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.editorial-article:hover\s*\{[^}]*transform:\s*translate\(-2px, -2px\)/
    );
  });

  it("turns off compositor-heavy card and sticky-bar effects on touch screens", () => {
    expect(editorialCss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?\.editorial-article\s*\{[^}]*transition:\s*none/
    );
    expect(editorialCss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?\.editorial-static-article-topbar\s*\{[^}]*(?:-webkit-backdrop-filter|backdrop-filter):\s*none/
    );
  });

  it("removes the fixed global grain overlay from official pages", () => {
    expect(officialCss).toMatch(
      /html\.official-site-root body\.official-site-body::after\s*\{[^}]*display:\s*none/
    );
  });

  it("reserves a stable frame for lazy article-body images", () => {
    expect(markdownRenderer).toMatch(/className="md-image-frame"/);
    expect(markdownRenderer).toMatch(/width=\{1200\}[\s\S]*height=\{675\}/);
    expect(globalCss).toMatch(/\.article-prose \.md-image-frame\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    expect(globalCss).toMatch(/\.article-prose \.md-image-frame img\s*\{[^}]*height:\s*100%/);
  });

  it("updates reading progress without rerendering the Markdown tree on every scroll frame", () => {
    expect(postContent).toMatch(/const progressRef = useRef/);
    expect(postContent).toMatch(/requestAnimationFrame/);
    expect(postContent).not.toMatch(/setProgress\(/);
    expect(postContent).toMatch(/ref=\{progressRef\}/);
  });
});
