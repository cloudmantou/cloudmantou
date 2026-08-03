import { describe, expect, it, vi } from "vitest";
import {
  createPaidPostOrder,
  getPaidPostLoginHref,
  shouldOfferPaidPostPurchase,
} from "@/components/payment/PostPurchaseButton";
import { normalizeInternalReturnUrl } from "@/lib/return-url";

describe("paid-post purchase flow", () => {
  it("sends a visitor back to the localized article after login", () => {
    expect(getPaidPostLoginHref("mantou-assistant", "zh")).toBe(
      "/login?callbackUrl=%2Fpost%2Fmantou-assistant"
    );
    expect(getPaidPostLoginHref("mantou-assistant", "en")).toBe(
      "/en/login?callbackUrl=%2Fen%2Fpost%2Fmantou-assistant"
    );
  });

  it("creates only the server-priced PAID_POST order and returns checkout identity", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      code: 0,
      message: "ok",
      data: {
        id: "order-paid-post-1",
        orderNo: "ORD20260803PAID",
        title: "Deep paid note",
        amount: 19.9,
      },
    }), { status: 200 }));

    await expect(createPaidPostOrder("post-42", "en", request as typeof fetch)).resolves.toEqual({
      id: "order-paid-post-1",
      orderNo: "ORD20260803PAID",
      title: "Deep paid note",
      amount: 19.9,
    });
    expect(request).toHaveBeenCalledWith("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType: "PAID_POST", productId: "post-42" }),
    });
  });

  it("surfaces the server error rather than opening checkout for a rejected order", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ code: 40400, message: "文章不存在或非付费文章", data: null }), { status: 404 }));

    await expect(createPaidPostOrder("missing", "zh", request as typeof fetch)).rejects.toThrow(
      "文章不存在或非付费文章"
    );
  });

  it("keeps English order failures localized", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ code: 40400, message: "文章不存在", data: null }), { status: 404 }));

    await expect(createPaidPostOrder("missing", "en", request as typeof fetch)).rejects.toThrow(
      "Unable to create the order"
    );
  });

  it.each([
    null,
    {},
    { id: "order", orderNo: "ORD", title: "Post", amount: "19.90" },
    { id: "order", orderNo: "ORD", title: "Post" },
  ])("rejects malformed checkout order data: %j", async (data) => {
    const request = vi.fn(async () => new Response(JSON.stringify({ code: 0, message: "ok", data })));

    await expect(createPaidPostOrder("post-42", "en", request as typeof fetch)).rejects.toThrow(
      "Unable to create the order"
    );
  });

  it("does not offer a duplicate purchase after VIP or direct article access", () => {
    expect(shouldOfferPaidPostPurchase("PAID_ONLY", "no_access")).toBe(true);
    expect(shouldOfferPaidPostPurchase("PAID_ONLY", "article_credit_available")).toBe(true);
    expect(shouldOfferPaidPostPurchase("PAID_ONLY", "vip_active")).toBe(false);
    expect(shouldOfferPaidPostPurchase("PAID_ONLY", "paid_post_entitled")).toBe(false);
    expect(shouldOfferPaidPostPurchase("PUBLISHED", "published")).toBe(false);
  });

  it("keeps checkout completion destinations inside the application", () => {
    expect(normalizeInternalReturnUrl("/en/post/paid", "/en/dashboard")).toBe("/en/post/paid");
    expect(normalizeInternalReturnUrl("https://outside.example", "/en/dashboard")).toBe("/en/dashboard");
  });
});
