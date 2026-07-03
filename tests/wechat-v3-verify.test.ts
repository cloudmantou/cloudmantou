import { describe, expect, it, vi, afterEach } from "vitest";
import { verifyWechatV3Sign } from "@/lib/payment";

describe("verifyWechatV3Sign — replay and serial checks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects timestamps outside replay window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));

    const ok = verifyWechatV3Sign(
      String(Math.floor(Date.now() / 1000) - 400),
      "nonce",
      "{}",
      "sig",
      "serial",
      "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/yNUw\n-----END PUBLIC KEY-----",
      { maxSkewSec: 300 }
    );

    expect(ok).toBe(false);
  });

  it("rejects mismatched platform serial when configured", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T12:00:00Z"));

    const ok = verifyWechatV3Sign(
      String(Math.floor(Date.now() / 1000)),
      "nonce",
      "{}",
      "sig",
      "serial-a",
      "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/yNUw\n-----END PUBLIC KEY-----",
      { expectedSerial: "serial-b", maxSkewSec: 300 }
    );

    expect(ok).toBe(false);
  });
});