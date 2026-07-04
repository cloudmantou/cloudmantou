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

export function generateCspNonce(): string {
  return btoa(crypto.randomUUID());
}

export function usesScriptNonce(dev = process.env.NODE_ENV === "development"): boolean {
  return !dev;
}

/** 全站 CSP；生产 script 使用 nonce，开发保留 inline/eval 以兼容 HMR 与 React DevTools */
export function buildContentSecurityPolicy(
  nonce: string,
  dev = process.env.NODE_ENV === "development"
): string {
  const scriptSrc = dev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action ${ALIPAY_FORM_ACTION_CSP}`,
  ].join("; ");
}