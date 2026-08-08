import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Mantou article deployment script", () => {
  it("marks managed translations stale atomically when source copy changes", () => {
    const script = readFileSync(
      join(process.cwd(), "scripts/upsert-mantou-article.mjs"),
      "utf8",
    );

    expect(script).toMatch(/createHash\(["']sha256["']\)/);
    expect(script).toMatch(/prisma\.\$transaction\(async \(tx\)/);
    expect(script).toMatch(/computeSourceHash\(existingPost\)[\s\S]*computeSourceHash\(updatedPost\)/);
    expect(script).toMatch(/tx\.postTranslation\.updateMany\([\s\S]*status:\s*["']STALE["']/);
  });
});
