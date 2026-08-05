/**
 * 支付宝页面支付 form-action 白名单。
 * Chrome 会继续检查 POST 后的 302 收银台跳转，因此网关和最终收银台
 * 必须同时列出；保留精确官方域名，避免放宽为任意 HTTPS 或通配子域。
 */
export const ALIPAY_FORM_ACTION_ORIGINS = [
  "'self'",
  "https://openapi.alipay.com",
  "https://unitradeprod.alipay.com",
  "https://excashier.alipay.com",
  "https://mclient.alipay.com",
  "https://openapi.alipaydev.com",
  "https://openapi-sandbox.dl.alipaydev.com",
  "https://unitradeprod-sandbox.dl.alipaydev.com",
  "https://excashier-sandbox.dl.alipaydev.com",
  "https://mobileclientgw-sandbox.dl.alipaydev.com",
] as const;

export const ALIPAY_FORM_ACTION_CSP = ALIPAY_FORM_ACTION_ORIGINS.join(" ");

export function buildAlipayLaunchContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `form-action ${ALIPAY_FORM_ACTION_CSP}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; ");
}

export function generateCspNonce(): string {
  return btoa(crypto.randomUUID());
}

/** Only middleware-generated base64/base64url tokens may reach a CSP header. */
export function resolveCspNonce(value: string | null): string {
  const nonce = value?.trim() || "";
  return /^[A-Za-z0-9+/_=-]{12,256}$/.test(nonce) ? nonce : generateCspNonce();
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
