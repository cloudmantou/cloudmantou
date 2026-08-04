import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("compact editorial layout", () => {
  it("uses a narrower content rail and restrained desktop type scale", () => {
    const css = readFileSync("src/styles/editorial-blog.css", "utf8");

    expect(css).toMatch(/\.editorial-container\s*\{[^}]*1200px/);
    expect(css).toMatch(/\.editorial-hero-copy h1\s*\{[^}]*4\.7vw[^}]*4\.7rem/);
    expect(css).toMatch(/\.editorial-feature-heading h2\s*\{[^}]*4\.2vw[^}]*4rem/);
    expect(css).toMatch(/\.editorial-article-hero h1\s*\{[^}]*4vw[^}]*4\.25rem/);
  });
});
