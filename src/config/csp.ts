/** 支付宝网关 form-action 白名单（与 next.config.mjs 保持同步） */
export const ALIPAY_FORM_ACTION_ORIGINS = [
  "'self'",
  "https://openapi.alipay.com",
  "https://openapi.alipaydev.com",
  "https://openapi-sandbox.dl.alipaydev.com",
] as const;

export const ALIPAY_FORM_ACTION_CSP = ALIPAY_FORM_ACTION_ORIGINS.join(" ");

export const ALIPAY_LAUNCH_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  `form-action ${ALIPAY_FORM_ACTION_CSP}`,
  "base-uri 'none'",
].join("; ");