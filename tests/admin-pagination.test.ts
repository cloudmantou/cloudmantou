import { describe, expect, it } from "vitest";
import { buildPageWindow, clampPageAfterRemoval } from "@/lib/admin-pagination";

describe("admin pagination window", () => {
  it("lists every page when there are only a few", () => {
    expect(buildPageWindow(1, 1)).toEqual([1]);
    expect(buildPageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps first, last and nearby pages reachable beyond page 10", () => {
    expect(buildPageWindow(1, 40)).toEqual([1, 2, 3, "gap", 40]);
    expect(buildPageWindow(20, 40)).toEqual([1, "gap", 18, 19, 20, 21, 22, "gap", 40]);
    expect(buildPageWindow(40, 40)).toEqual([1, "gap", 38, 39, 40]);
  });

  it("fills a single skipped page instead of showing an ellipsis", () => {
    expect(buildPageWindow(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("clamps out-of-range input", () => {
    expect(buildPageWindow(99, 3)).toEqual([1, 2, 3]);
    expect(buildPageWindow(0, 0)).toEqual([1]);
  });

  it("steps back a page after deleting the last row on it", () => {
    expect(clampPageAfterRemoval(3, 0)).toBe(2);
    expect(clampPageAfterRemoval(3, 4)).toBe(3);
    expect(clampPageAfterRemoval(1, 0)).toBe(1);
  });
});
