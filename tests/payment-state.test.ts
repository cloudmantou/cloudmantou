import { describe, expect, it } from "vitest";
import {
  assertOrderTransition,
  assertPaymentTransition,
  canTransitionOrder,
  canTransitionPayment,
  InvalidStateTransitionError,
} from "@/lib/payment-state";

describe("payment-state", () => {
  it("allows pending order to become paid, cancelled, or expired", () => {
    expect(canTransitionOrder("PENDING", "PAID")).toBe(true);
    expect(canTransitionOrder("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("PENDING", "EXPIRED")).toBe(true);
  });

  it("blocks illegal order transitions", () => {
    expect(canTransitionOrder("PAID", "PENDING")).toBe(false);
    expect(canTransitionOrder("EXPIRED", "PAID")).toBe(false);
  });

  it("allows payment waiting to success, failed, or closed", () => {
    expect(canTransitionPayment("WAITING", "SUCCESS")).toBe(true);
    expect(canTransitionPayment("WAITING", "FAILED")).toBe(true);
    expect(canTransitionPayment("WAITING", "CLOSED")).toBe(true);
  });

  it("throws on invalid transitions", () => {
    expect(() => assertOrderTransition("PAID", "PENDING")).toThrow(InvalidStateTransitionError);
    expect(() => assertPaymentTransition("CLOSED", "WAITING")).toThrow(InvalidStateTransitionError);
  });
});