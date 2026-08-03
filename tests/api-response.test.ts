import { describe, expect, it } from "vitest";
import { fail, ok } from "@/lib/api-response";
import { readApiEnvelope } from "@/lib/client-api-response";

describe("api response helpers", () => {
  it("wraps successful responses in the shared envelope", async () => {
    const response = ok({ id: "post-1" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: 0,
      message: "ok",
      data: { id: "post-1" },
    });
  });

  it("includes pagination only when provided", async () => {
    const response = ok(["post-1"], {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    const body = await response.json();

    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("wraps failures without leaking data", async () => {
    const response = fail("参数错误", 40000, 400);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 40000,
      message: "参数错误",
      data: null,
    });
  });
});

describe("client API response reader", () => {
  it("returns a valid JSON object", async () => {
    const response = new Response(JSON.stringify({ code: 0, message: "ok", data: [{ id: "product-1" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(readApiEnvelope(response, "Load failed")).resolves.toEqual({
      code: 0,
      message: "ok",
      data: [{ id: "product-1" }],
    });
  });

  it.each(["", "not-json", "[]", "null", "{}", "{\"code\":0,\"message\":\"ok\"}"])(
    "uses the friendly fallback for an invalid payload: %j",
    async (payload) => {
      const response = new Response(payload, { status: 200 });

      await expect(readApiEnvelope(response, "Load failed")).rejects.toThrow("Load failed");
    }
  );

  it("uses a server message for a failed JSON response", async () => {
    const response = new Response(JSON.stringify({ code: 50300, message: "Temporarily unavailable", data: null }), {
      status: 503,
    });

    await expect(readApiEnvelope(response, "Load failed")).rejects.toThrow(
      "Temporarily unavailable"
    );
  });

  it("uses the fallback for a failed response without a usable message", async () => {
    const response = new Response("<html>gateway error</html>", { status: 502 });

    await expect(readApiEnvelope(response, "Load failed")).rejects.toThrow("Load failed");
  });

  it("uses the localized fallback when server messages are disabled", async () => {
    const response = new Response(JSON.stringify({ code: 40400, message: "中文错误", data: null }), {
      status: 404,
    });

    await expect(readApiEnvelope(response, "Unable to create the order", false)).rejects.toThrow(
      "Unable to create the order"
    );
  });

  it("rejects a non-zero envelope code even with HTTP 200", async () => {
    const response = new Response(JSON.stringify({ code: 50000, message: "Logical failure", data: null }));

    await expect(readApiEnvelope(response, "Load failed")).rejects.toThrow("Logical failure");
  });
});
