import { describe, expect, it } from "vitest";
import { classifyAiAvailability } from "@/lib/ai/editor-availability";

describe("editorial AI availability", () => {
  it("enables generation only for a ready configuration", () => {
    expect(classifyAiAvailability(200, { data: { status: "ready" } })).toEqual({
      state: "ready",
      message: "",
    });
    expect(classifyAiAvailability(200, { data: { status: "disabled" } })).toEqual({
      state: "needs-setup",
      message: "AI 模型尚未配置",
    });
  });

  it("keeps generation blocked when the status request is unauthorized or fails", () => {
    expect(classifyAiAvailability(401, null)).toEqual({
      state: "unavailable",
      message: "管理员登录状态已失效，请重新登录",
    });
    expect(classifyAiAvailability(500, { message: "database unavailable" })).toEqual({
      state: "unavailable",
      message: "AI 配置状态检查失败，请刷新页面后重试",
    });
  });
});
