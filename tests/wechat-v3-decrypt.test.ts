import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { decryptWechatV3Resource } from "@/lib/payment";

function encryptForTest(
  apiV3Key: string,
  plaintext: Record<string, unknown>,
  associatedData = "transaction",
  nonce = "123456789012"
) {
  const keyBytes = Buffer.from(apiV3Key, "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes, Buffer.from(nonce, "utf8"));
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const data = Buffer.from(JSON.stringify(plaintext), "utf8");
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, tag]);
  return {
    ciphertext: combined.toString("base64"),
    nonce,
    associated_data: associatedData,
  };
}

describe("decryptWechatV3Resource", () => {
  const apiV3Key = "0123456789abcdef0123456789abcdef";

  it("decrypts v3 callback resource with utf8 api key", () => {
    const payload = {
      out_trade_no: "ORD001",
      transaction_id: "WX001",
      trade_state: "SUCCESS",
      amount: { total: 100 },
    };
    const resource = encryptForTest(apiV3Key, payload);
    const result = decryptWechatV3Resource(resource, apiV3Key);
    expect(result.out_trade_no).toBe("ORD001");
    expect(result.transaction_id).toBe("WX001");
  });

  it("rejects invalid key length", () => {
    expect(() =>
      decryptWechatV3Resource({ ciphertext: "e30=", nonce: "123456789012" }, "short")
    ).toThrow(/32 bytes/);
  });
});