import { describe, expect, it } from "vitest";

import { normalizeInternalReturnUrl } from "@/lib/return-url";

describe("normalizeInternalReturnUrl", () => {
  it("preserves a local pathname, query, and fragment", () => {
    expect(normalizeInternalReturnUrl("/post/hello?from=pricing#comments", "/")).toBe(
      "/post/hello?from=pricing#comments"
    );
  });

  it("uses the supplied fallback for external, malformed, and protocol-relative targets", () => {
    for (const value of [
      "https://example.com/collect",
      "//example.com/collect",
      "\\\\example.com\\collect",
      "javascript:alert(1)",
      "post/hello",
      " /post/hello",
      null,
    ]) {
      expect(normalizeInternalReturnUrl(value, "/pricing")).toBe("/pricing");
    }
  });
});
