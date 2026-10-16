import { describe, expect, it } from "vitest";
import { feedbackCreateSchema, feedbackPolicySchema, canTransition, rewardStages } from "@/lib/feedback";
describe("feedback contracts", () => {
  const valid = { kind: "BUG", title: "阅读问题反馈", content: "打开阅读页面之后无法返回" };
  it("rejects forged status, points and external screenshots", () => {
    expect(feedbackCreateSchema.safeParse({ ...valid, status: "COMPLETED" }).success).toBe(false);
    expect(feedbackCreateSchema.safeParse({ ...valid, points: 500 }).success).toBe(false);
    expect(feedbackCreateSchema.safeParse({ ...valid, imageIds: ["https://x/a.png"] }).success).toBe(false);
  });
  it("trims fields, permits privacy, and caps screenshots", () => {
    expect(feedbackCreateSchema.parse({ ...valid, allowPublic: false }).allowPublic).toBe(false);
    expect(feedbackCreateSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(feedbackCreateSchema.safeParse({ ...valid, imageIds: Array(4).fill("clzzzzzzzzzzzzzzzzzzzzzzzz") }).success).toBe(false);
  });
  it("does not reward submissions or rejection; completing also covers acceptance", () => {
    expect(rewardStages("SUBMITTED")).toEqual([]); expect(rewardStages("DECLINED")).toEqual([]);
    expect(rewardStages("IN_PROGRESS")).toEqual(["accepted"]); expect(rewardStages("COMPLETED")).toEqual(["accepted", "completed"]);
  });
  it("permits reopening but rejects regressions that erase progress", () => {
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("COMPLETED", "SUBMITTED")).toBe(false);
    expect(canTransition("IN_PROGRESS", "ACCEPTED")).toBe(false);
    expect(canTransition("ACCEPTED", "ACCEPTED")).toBe(true);
  });
  it("bounds rewards to nonnegative integers", () => {
    expect(feedbackPolicySchema.safeParse({ accepted: -1, completed: 40 }).success).toBe(false);
    expect(feedbackPolicySchema.safeParse({ accepted: 1.5, completed: 40 }).success).toBe(false);
    expect(feedbackPolicySchema.parse({ accepted: 0, completed: 40 })).toEqual({ accepted: 0, completed: 40 });
  });
});
