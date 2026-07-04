/** 与 src/config/csp.ts 中 ALIPAY_FORM_ACTION_CSP 保持同步 */
const ALIPAY_FORM_ACTION_CSP =
  "'self' https://openapi.alipay.com https://openapi.alipaydev.com https://openapi-sandbox.dl.alipaydev.com";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      `form-action ${ALIPAY_FORM_ACTION_CSP}`,
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["ioredis", "sharp"],
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.playwright-cli/**",
          "**/current-ui-preview*.png",
          "**/homepage-*.png",
        ],
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        // 支付跳转页不叠加全站 CSP，由 route handler 返回独立策略
        source: "/((?!payment/alipay-launch).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
