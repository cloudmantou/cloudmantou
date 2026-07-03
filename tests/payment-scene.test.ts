import { describe, expect, it } from "vitest";
import {
  detectPaymentScene,
  resolveAlipayMode,
  resolveWechatMode,
} from "@/lib/payment-scene";

describe("payment scene", () => {
  it("detects pc user agent", () => {
    expect(detectPaymentScene("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("pc");
  });

  it("detects mobile h5 user agent", () => {
    expect(detectPaymentScene("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("h5");
  });

  it("detects wechat in-app browser", () => {
    expect(detectPaymentScene("Mozilla/5.0 MicroMessenger/8.0.0")).toBe("wechat_inapp");
  });

  it("maps scene to pay modes", () => {
    expect(resolveAlipayMode("pc")).toBe("page");
    expect(resolveAlipayMode("h5")).toBe("wap");
    expect(resolveWechatMode("pc")).toBe("native");
    expect(resolveWechatMode("wechat_inapp")).toBe("mweb");
  });
});