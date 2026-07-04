import { describe, expect, it } from "vitest";
import { isPemEncoded } from "@/lib/payment-config";
import { createAlipayPayment } from "@/lib/payment-providers";

const PKCS8_PRIVATE =
  "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQChiguujX1aijsFixT7qYPh5DEdCwRS0zyflzCzpiNOeruE+EudfTB6jnnliA4/uG5ew7yAjKhlkyB/hc7D02dq24PQ2RSQ/buxgIP0mJZw4XJMWv9BM+wTAP+AlPR8LHc6fWqURSlVVBz/ScwRtLIXV1m8dzXbm7KYUVJDzolAJiacVxddMFR68xEOposHNBliQTL0U+tXhAEXrlZxT8e8h/wivoAu/ABBMpjP67xXmgL5dO2pfKIUnJhUXvPthDcngmBEv51uYw3oVuHBGSdYGnyHtdytNRiOUvAxPy00qBgF/aAJK+K7K9cPXcHBZgLjFWacRgRRNrjjBfbg8x2jAgMBAAECggEAV+lapioWODnWGRQx3SvJvBuFpvqh5blT2r5bIMmfmUwt1RWTgSfqRChZqlK6/m6OkkAPzB3AX1cMbpoRhnz8YSkJuZUKHkYX6We5aFnKNbBblbZIB+IL7eOzKPTngNRqJoiugfaJoghep4gv6MrfyNge2/Q8eUFoloBbNs+l3iSHGsKs2PQR0uJl/nOV+IIjew16ZLK5X4Uka7uluVT/fXQGpYXJqbN0FF9Nv+T8bfvUzRiWigTz3801GCkJzK3vj12j7UDPFR9hoF1jPrvtxZD+jIs7ln2nnsSbAjqYdPNDySWTrPZcMWWxLjfAyOkiQkl7Qb4EcK5NcxedRVkLsQKBgQDa1PWEvWT4kj/GfivRTEHEqApsDSTLzrt66gK9uqpQkyDONqWtTAv+jqc+ydQ7sBQps55FbET7ueBr9V8C8mevYUwZdNFhIGHyYdtww3nGZG4OOw3Wp/1EYk5F3QbQuleM+hlPgGRoyfVt1j8N6JjW1Xim6uTFcuDxAplORdUIBQKBgQC8+fFF8LWP2rdysiyvvPv6VlJ4915z09gSS5Yjm/9eFGA3XxD6KqKA2+DD9Ua+bt/hVXnWdY05IhEFjwDYlCgG/zVvSb7NifL9o6F4veP3GUPOzMBP2ivxFKkM/Nsh3i/sIQ5pwLyAIZOlL7IyeJ7sx1gtITa1jdMaQJkZsODHhwKBgFFvsRK9/MZ4fp1atOnFzC/oLUC6v3fNLn32eiCrR9iGeE3ljlBonYoVAm5eY8n2o/pE6uCBA0b+jGMAxGPvW+Crf8t1aroPeAPgoO5dAINxOne3SFYa3CjHwMNFFtU0k4JWTHcGm9dXWSuP8JU3ezFv7d+ISKymLMnkIrM7T6UVAoGATdQmgSaMsC1k5jDpZItRv50zpCxE0zFJSOemcw35U1bS9ZsKk+1hNe7Yl/v5Yc6qF9SrNB7/xar5Fa/6qjgCcDdFW4sksOQClmGAzAhwzcCzA4WiIoD5HfXjVb0BxuYKGJbYp8dAGwk5FIwbONwin+PNtfB65rT9X0+BfmoxeRsCgYBQDqH43ZnnaFLEJjiI1y3Ji4SSDG4e9Lt1SrYRPl6Bv3FtuBX1KmeltSD/4XeVrW6BaK81agjt5ayd8Ix3NaPK8orRz1Zoj/JKFQon3V4Q1HMB6dJFVrB4RwXZoOoG8aKOAbPFNU1/OAKhD58Sid6AG7arRUwAc8nnk+tcXnd/8A==";

describe("isPemEncoded", () => {
  it("detects PEM headers only at line start", () => {
    expect(isPemEncoded("-----BEGIN PRIVATE KEY-----\nabc")).toBe(true);
    expect(isPemEncoded(PKCS8_PRIVATE)).toBe(false);
    expect(isPemEncoded("notBEGIN but has BEGIN in text")).toBe(false);
  });
});

describe("Alipay PKCS#8 private key", () => {
  it("builds signed sandbox form with OPEN platform PKCS#8 key", () => {
    const result = createAlipayPayment({
      config: {
        enabled: true,
        env: "sandbox",
        appId: "9021000165610224",
        privateKey: PKCS8_PRIVATE,
        publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhruBMOpGpScE51ysN+yfLsbdo1Oo9dGjOeNJy7gQ8gOV7hUALi7821xp523ES7Prjle032071Ygpa5cm/5YLXCJhp60b9zhjh3AXlbP5kh4xRrM/mi9pwtNHr47BebIIsdazXYvCXvlZ4OzAkBUMbBBf5dmDV65MQ1Zuz2zj9iNeIvnIh5nW3HjNARv7n9k1YzwmeYPt0H3w1QNH9OxaBOsmKV7Bgwp/sNT07BsUoU8rjDuvuvfmq4qTqrx1EmJ0IZByl6kaelwspvl4WcDPfPopYQed0lHWi0ACXNcGBd1mGq66WpRt5mXkWVkGyVKqWMfkMNkZp/7M/md3Ky5NbwIDAQAB",
      },
      mode: "page",
      orderNo: "ORD-SANDBOX-001",
      title: "沙箱测试",
      amount: 0.01,
      notifyUrl: "http://localhost:3000/api/payment/notify/alipay",
      returnUrl: "http://localhost:3000/payment/result",
    });

    expect(result.type).toBe("form");
    if (result.type === "form") {
      expect(result.html).toContain("openapi-sandbox.dl.alipaydev.com");
      expect(result.html).toContain('name="sign"');
    }
  });
});