import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paymentHarness = vi.hoisted(() => ({
  findUnique: vi.fn<
    (args: { where: { key: string } }) => Promise<{ value: string } | null>
  >(),
  decryptGatewaySecrets: vi.fn((value: Record<string, Record<string, unknown>>) => value),
  createSign: vi.fn(() => ({
    update: vi.fn(),
    sign: vi.fn(() => "test-signature"),
  })),
  verifyResponse: vi.fn(() => true),
  createVerify: vi.fn(() => ({
    update: vi.fn(),
    verify: vi.fn(() => paymentHarness.verifyResponse()),
  })),
  createHash: vi.fn(() => {
    const hash = {
      update: vi.fn(),
      digest: vi.fn(() => "TESTHASH"),
    };
    hash.update.mockReturnValue(hash);
    return hash;
  }),
  randomBytes: vi.fn(() => Buffer.from("00112233445566778899aabbccddeeff", "hex")),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { siteSetting: { findUnique: paymentHarness.findUnique } },
}));

vi.mock("@/lib/secret-crypto", () => ({
  decryptGatewaySecrets: paymentHarness.decryptGatewaySecrets,
}));

vi.mock("crypto", () => ({
  default: {
    createSign: paymentHarness.createSign,
    createVerify: paymentHarness.createVerify,
    createHash: paymentHarness.createHash,
    randomBytes: paymentHarness.randomBytes,
    timingSafeEqual: (left: Buffer, right: Buffer) => left.equals(right),
  },
}));

import {
  getAlipayGatewayUrl,
  getPaymentRuntimeConfig,
  isPemEncoded,
  normalizeAlipayEnv,
  normalizePem,
  type AlipayGatewayConfig,
  type WechatGatewayConfig,
} from "@/lib/payment-config";
import {
  createAlipayPayment,
  createWechatPayment,
  queryAlipayTrade,
  queryWechatTrade,
} from "@/lib/payment-providers";
import {
  detectPaymentScene,
  resolveAlipayMode,
  resolveWechatMode,
  sceneLabel,
} from "@/lib/payment-scene";

const PAYMENT_ENV_KEYS = [
  "SITE_URL",
  "NEXTAUTH_URL",
  "AUTH_URL",
  "PAYMENT_TEST_MODE",
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "ALIPAY_SELLER_ID",
  "ALIPAY_ENV",
  "WECHAT_APP_ID",
  "WECHAT_MCH_ID",
  "WECHAT_API_KEY",
  "WECHAT_API_V3_KEY",
  "WECHAT_V3_PUBLIC_KEY",
  "WECHAT_V3_PLATFORM_SERIAL",
] as const;

const alipayConfig: AlipayGatewayConfig = {
  enabled: true,
  env: "sandbox",
  appId: "test-app",
  privateKey: "private-key-body",
  publicKey: "public-key-body",
};

const wechatConfig: WechatGatewayConfig = {
  enabled: true,
  appId: "wx-test",
  mchId: "mch-test",
  apiKey: "api-key",
};

// WeChat V2 returns its own signed random string; it does not echo the request nonce.
const WECHAT_RESPONSE_NONCE = "IITRi8Iabbblz1Jc";

function mockFetchText(text: string) {
  const fetchMock = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue(text) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function wechatInput(mode: "native" | "mweb") {
  return {
    config: wechatConfig,
    mode,
    orderNo: "ORDER-1",
    title: "Membership",
    amount: 12.345,
    notifyUrl: "https://example.test/api/payment/notify/wechat",
    clientIp: "",
    returnUrl: "https://example.test/payment/result",
  } as const;
}

describe("payment runtime configuration", () => {
  beforeEach(() => {
    paymentHarness.findUnique.mockReset();
    paymentHarness.decryptGatewaySecrets.mockClear();
    for (const key of PAYMENT_ENV_KEYS) vi.stubEnv(key, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes PEM bodies, existing PEM values, environments, and gateway URLs", () => {
    const existing = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";

    expect(isPemEncoded(`  ${existing}  `)).toBe(true);
    expect(isPemEncoded("abc-----BEGIN PRIVATE KEY-----")).toBe(false);
    expect(normalizePem(existing, "private")).toBe(existing);
    expect(normalizePem("MIIEowAB", "private")).toContain("BEGIN RSA PRIVATE KEY");
    expect(normalizePem("MIIJAB", "private")).toContain("BEGIN PRIVATE KEY");
    expect(normalizePem("PUBLICBODY", "public")).toContain("BEGIN PUBLIC KEY");
    expect(normalizeAlipayEnv("沙箱环境")).toBe("sandbox");
    expect(normalizeAlipayEnv("sandbox")).toBe("sandbox");
    expect(normalizeAlipayEnv("anything-else")).toBe("production");
    expect(getAlipayGatewayUrl("sandbox")).toContain("sandbox");
    expect(getAlipayGatewayUrl("production")).toBe("https://openapi.alipay.com/gateway.do");
  });

  it("prefers decrypted database settings and requires both switches for test mode", async () => {
    const rows: Record<string, { value: string }> = {
      paymentGateways: {
        value: JSON.stringify({
          alipay: {
            enabled: true,
            env: "沙箱环境",
            appId: "db-app",
            privateKey: "db-private",
            publicKey: "db-public",
            sellerId: "seller",
          },
          wechat: {
            enabled: true,
            appId: "db-wx",
            mchId: "db-mch",
            apiV3Key: "v3-fallback-key",
            publicKey: "wechat-public",
            platformSerial: "serial",
          },
        }),
      },
      paymentTestMode: { value: "true" },
      siteUrl: { value: "https://pay.example/" },
    };
    paymentHarness.findUnique.mockImplementation(async ({ where }) => rows[where.key] ?? null);
    vi.stubEnv("PAYMENT_TEST_MODE", "true");

    const config = await getPaymentRuntimeConfig();

    expect(paymentHarness.decryptGatewaySecrets).toHaveBeenCalledTimes(1);
    expect(config).toMatchObject({
      siteUrl: "https://pay.example",
      testMode: true,
      alipay: { appId: "db-app", env: "sandbox", sellerId: "seller" },
      wechat: {
        appId: "db-wx",
        mchId: "db-mch",
        apiKey: "v3-fallback-key",
        apiV3Key: "v3-fallback-key",
        publicKey: "wechat-public",
        platformSerial: "serial",
      },
    });
    expect(config.alipay?.privateKey).toContain("BEGIN PRIVATE KEY");
  });

  it("falls back to environment settings and disables incomplete gateways", async () => {
    paymentHarness.findUnique.mockResolvedValue(null);
    vi.stubEnv("AUTH_URL", "https://auth.example/");
    vi.stubEnv("ALIPAY_APP_ID", "env-app");
    vi.stubEnv("ALIPAY_PRIVATE_KEY", "env-private");
    vi.stubEnv("ALIPAY_PUBLIC_KEY", "env-public");
    vi.stubEnv("ALIPAY_ENV", "sandbox");
    vi.stubEnv("WECHAT_APP_ID", "env-wx");
    vi.stubEnv("WECHAT_MCH_ID", "env-mch");
    vi.stubEnv("WECHAT_API_KEY", "env-api-key");

    const configured = await getPaymentRuntimeConfig();
    expect(configured).toMatchObject({
      siteUrl: "https://auth.example",
      testMode: false,
      alipay: { appId: "env-app", env: "sandbox" },
      wechat: { appId: "env-wx", mchId: "env-mch", apiKey: "env-api-key" },
    });

    paymentHarness.findUnique.mockImplementation(async ({ where }) =>
      where.key === "paymentGateways"
        ? { value: JSON.stringify({ alipay: { enabled: false }, wechat: { enabled: false } }) }
        : null
    );
    const disabled = await getPaymentRuntimeConfig();
    expect(disabled.alipay).toBeNull();
    expect(disabled.wechat).toBeNull();
  });

  it("recovers from malformed gateway JSON with safe empty defaults", async () => {
    paymentHarness.findUnique.mockImplementation(async ({ where }) =>
      where.key === "paymentGateways" ? { value: "not-json" } : null
    );

    await expect(getPaymentRuntimeConfig()).resolves.toEqual({
      siteUrl: "http://localhost:3000",
      testMode: false,
      alipay: null,
      wechat: null,
    });
  });
});

describe("payment provider production exports", () => {
  beforeEach(() => {
    paymentHarness.createSign.mockClear();
    paymentHarness.createHash.mockClear();
    paymentHarness.randomBytes.mockClear();
    paymentHarness.createVerify.mockClear();
    paymentHarness.verifyResponse.mockReset();
    paymentHarness.verifyResponse.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a signed Alipay form and escapes untrusted form values", () => {
    const result = createAlipayPayment({
      config: alipayConfig,
      mode: "wap",
      orderNo: 'ORDER-&-"',
      title: "<Membership>",
      amount: 12.3,
      notifyUrl: "https://example.test/notify?x=1&y=2",
      returnUrl: "https://example.test/result",
      scriptNonce: 'nonce-<&"',
    });

    expect(result).toMatchObject({ type: "form", mode: "alipay_h5" });
    if (result.type === "form") {
      const action = result.html.match(/<form[^>]+action="([^"]+)"/)?.[1];
      expect(action).toBeDefined();
      expect(action).toContain("charset=utf-8");
      expect(action).toContain("method=alipay.trade.wap.pay");
      expect(action).toContain("sign=test-signature");
      expect(action).not.toContain("biz_content=");
      expect(result.html).toContain("alipay.trade.wap.pay");
      expect(result.html).toContain("QUICK_WAP_WAY");
      expect(result.html).toContain("test-signature");
      expect(result.html).toContain('name="biz_content"');
      expect(result.html).not.toContain('name="charset"');
      expect(result.html).not.toContain('name="sign"');
      expect(result.html).toContain("&amp;");
      expect(result.html).toContain("&quot;");
      expect(result.html).toContain("&lt;Membership&gt;");
      expect(result.html).toContain('nonce="nonce-&lt;&amp;&quot;"');
      expect(result.html).not.toContain("<script>");
    }
  });

  it("handles invalid, missing, failed, pending, and paid Alipay query responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ text: async () => "not-json" })
      .mockResolvedValueOnce({ text: async () => "{}" })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({ alipay_trade_query_response: { code: "40004", sub_msg: "not found" }, sign: "server-sign" }),
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: { code: "10000", trade_status: "WAIT_BUYER_PAY" },
            sign: "server-sign",
          }),
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            alipay_trade_query_response: {
              code: "10000",
              trade_status: "TRADE_FINISHED",
              out_trade_no: "E",
              trade_no: "TRADE-1",
              total_amount: "12.30",
            },
            sign: "server-sign",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "A" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应解析失败",
    });
    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "B" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应节点缺失或重复",
    });
    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "C" })).resolves.toMatchObject({
      paid: false,
      message: "not found",
    });
    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "D" })).resolves.toMatchObject({
      paid: false,
      tradeStatus: "WAIT_BUYER_PAY",
    });
    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "E" })).resolves.toMatchObject({
      paid: true,
      tradeNo: "TRADE-1",
      totalAmount: "12.30",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not mark an Alipay query paid when order identity or amount is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({
          alipay_trade_query_response: {
            code: "10000",
            trade_status: "TRADE_SUCCESS",
            out_trade_no: "OTHER-ORDER",
            trade_no: "TRADE-OTHER",
            total_amount: "12.30",
          },
          sign: "server-sign",
        }),
      })
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({
          alipay_trade_query_response: {
            code: "10000",
            trade_status: "TRADE_SUCCESS",
            out_trade_no: "ORDER-2",
            trade_no: "TRADE-NO-AMOUNT",
          },
          sign: "server-sign",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "ORDER-1" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应订单不匹配",
    });
    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "ORDER-2" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应缺少交易号或金额",
    });
  });

  it("rejects an Alipay query response whose root signature is invalid", async () => {
    paymentHarness.verifyResponse.mockReturnValue(false);
    mockFetchText(JSON.stringify({
      alipay_trade_query_response: {
        code: "10000",
        trade_status: "TRADE_SUCCESS",
        out_trade_no: "ORDER-1",
        trade_no: "TRADE-1",
        total_amount: "12.30",
      },
      sign: "invalid-server-sign",
    }));

    await expect(queryAlipayTrade({ config: alipayConfig, orderNo: "ORDER-1" })).resolves.toMatchObject({
      paid: false,
      message: "支付宝查单响应签名无效",
    });
  });

  it("creates WeChat native QR and H5 redirect payments", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () =>
          `<xml><return_code><![CDATA[SUCCESS]]></return_code><result_code>SUCCESS</result_code><appid>wx-test</appid><mch_id>mch-test</mch_id><nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str><code_url><![CDATA[weixin://qr/test]]></code_url><sign>TESTHASH</sign></xml>`,
      })
      .mockResolvedValueOnce({
        text: async () =>
          `<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code><appid>wx-test</appid><mch_id>mch-test</mch_id><nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str><mweb_url><![CDATA[https://wx.example/pay?a=1]]></mweb_url><sign>TESTHASH</sign></xml>`,
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWechatPayment(wechatInput("native"))).resolves.toEqual({
      type: "qrcode",
      codeUrl: "weixin://qr/test",
      mode: "wechat_native",
    });
    await expect(createWechatPayment(wechatInput("mweb"))).resolves.toEqual({
      type: "redirect",
      url: "https://wx.example/pay?a=1&redirect_url=https%3A%2F%2Fexample.test%2Fpayment%2Fresult",
      mode: "wechat_h5",
    });
    const requestBody = String(fetchMock.mock.calls[1]?.[1]?.body);
    expect(requestBody).toContain("<total_fee><![CDATA[1235]]></total_fee>");
    expect(requestBody).toContain("<spbill_create_ip><![CDATA[127.0.0.1]]></spbill_create_ip>");
    expect(requestBody).toContain("<scene_info>");
  });

  it("rejects an unsigned or mismatched WeChat unified-order response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () =>
          "<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code><appid>wx-test</appid><mch_id>mch-test</mch_id><code_url>weixin://qr/test</code_url></xml>",
      })
      .mockResolvedValueOnce({
        text: async () =>
          `<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code><appid>wx-other</appid><mch_id>mch-test</mch_id><nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str><code_url>weixin://qr/test</code_url><sign>TESTHASH</sign></xml>`,
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWechatPayment(wechatInput("native"))).rejects.toThrow("微信下单响应签名无效");
    await expect(createWechatPayment(wechatInput("native"))).rejects.toThrow("微信下单响应商户不匹配");
  });

  it("surfaces WeChat provider errors and missing launch URLs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () =>
          "<xml><return_code>FAIL</return_code><return_msg><![CDATA[bad request]]></return_msg></xml>",
      })
      .mockResolvedValueOnce({
        text: async () =>
          `<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code><appid>wx-test</appid><mch_id>mch-test</mch_id><nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str><sign>TESTHASH</sign></xml>`,
      })
      .mockResolvedValueOnce({
        text: async () =>
          `<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code><appid>wx-test</appid><mch_id>mch-test</mch_id><nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str><sign>TESTHASH</sign></xml>`,
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWechatPayment(wechatInput("native"))).rejects.toThrow("bad request");
    await expect(createWechatPayment(wechatInput("native"))).rejects.toThrow("微信未返回二维码链接");
    await expect(createWechatPayment(wechatInput("mweb"))).rejects.toThrow("微信未返回 H5 支付链接");
  });

  it("actively queries and verifies a paid WeChat order", async () => {
    const fetchMock = mockFetchText(
      "<xml>" +
      "<return_code>SUCCESS</return_code>" +
      "<result_code>SUCCESS</result_code>" +
      "<appid>wx-test</appid>" +
      "<mch_id>mch-test</mch_id>" +
      "<out_trade_no>ORDER-1</out_trade_no>" +
      `<nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str>` +
      "<trade_state>SUCCESS</trade_state>" +
      "<transaction_id>4200000000202608050000000001</transaction_id>" +
      "<total_fee>1235</total_fee>" +
      "<sign>TESTHASH</sign>" +
      "</xml>"
    );

    await expect(queryWechatTrade({
      config: wechatConfig,
      orderNo: "ORDER-1",
    })).resolves.toMatchObject({
      paid: true,
      transactionId: "4200000000202608050000000001",
      totalFee: 1235,
      tradeState: "SUCCESS",
    });
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("<out_trade_no>");
  });

  it("rejects an unsigned WeChat query response", async () => {
    mockFetchText(
      "<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code>" +
      "<trade_state>SUCCESS</trade_state><transaction_id>4200000000202608050000000001</transaction_id>" +
      "<total_fee>1235</total_fee></xml>"
    );

    await expect(queryWechatTrade({
      config: wechatConfig,
      orderNo: "ORDER-1",
    })).resolves.toMatchObject({ paid: false, message: "微信查单响应签名无效" });
  });

  it("rejects a signed WeChat query response for another order or merchant", async () => {
    mockFetchText(
      "<xml><return_code>SUCCESS</return_code><result_code>SUCCESS</result_code>" +
      "<appid>wx-other</appid><mch_id>mch-test</mch_id><out_trade_no>ORDER-OTHER</out_trade_no>" +
      `<nonce_str>${WECHAT_RESPONSE_NONCE}</nonce_str>` +
      "<trade_state>SUCCESS</trade_state><transaction_id>4200000000202608050000000001</transaction_id>" +
      "<total_fee>1235</total_fee><sign>TESTHASH</sign></xml>"
    );

    await expect(queryWechatTrade({
      config: wechatConfig,
      orderNo: "ORDER-1",
    })).resolves.toMatchObject({
      paid: false,
      message: "微信查单响应订单或商户不匹配",
    });
  });

});

describe("payment scene production exports", () => {
  it("detects scenes, resolves provider modes, and labels every branch", () => {
    expect(detectPaymentScene("Mozilla MicroMessenger Mobile")).toBe("wechat_inapp");
    expect(detectPaymentScene("Opera Mini")).toBe("h5");
    expect(detectPaymentScene("Desktop Browser")).toBe("pc");
    expect(resolveAlipayMode("pc")).toBe("page");
    expect(resolveAlipayMode("wechat_inapp")).toBe("wap");
    expect(resolveWechatMode("wechat_inapp")).toBeNull();
    expect(resolveWechatMode("pc")).toBe("native");
    expect(resolveWechatMode("h5")).toBe("mweb");
    expect(sceneLabel("pc")).toBe("电脑端");
    expect(sceneLabel("h5")).toBe("手机浏览器");
    expect(sceneLabel("wechat_inapp")).toBe("微信内");
    expect(sceneLabel("unknown" as never)).toBe("当前设备");
  });
});
