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
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["ioredis", "sharp"],
  images: {
    qualities: [72, 75],
    minimumCacheTTL: 2592000,
  },
  turbopack: {},
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
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, immutable",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        // 支付跳转页不叠加全站 CSP，由 route handler 返回独立策略
        source: "/((?!payment/alipay-launch).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
