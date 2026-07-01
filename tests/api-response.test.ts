import { describe, expect, it } from "vitest";
import { fail, ok } from "@/lib/api-response";

describe("api response helpers", () => {
  it("wraps successful responses in the shared envelope", async () => {
    const response = ok({ id: "post-1" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      code: 0,
      message: "ok",
      data: { id: "post-1" }
    });
  });

  it("includes pagination only when provided", async () => {
    const response = ok(["post-1"], {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1
    });
    const body = await response.json();

    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1
    });
  });

  it("wraps failures without leaking data", async () => {
    const response = fail("参数错误", 40000, 400);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 40000,
      message: "参数错误",
      data: null
    });
  });
});
