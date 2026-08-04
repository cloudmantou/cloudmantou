import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("release configuration", () => {
  it("does not pass runtime encryption keys through Docker build metadata", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const compose = readProjectFile("docker-compose.yml");

    expect(dockerfile).not.toMatch(/ARG\s+SETTINGS_ENCRYPTION_KEY/);
    expect(compose).not.toMatch(/args:\s*\n\s+SETTINGS_ENCRYPTION_KEY/);
  });

  it("copies the pnpm workspace manifest before the frozen dependency install", () => {
    const dockerfile = readProjectFile("Dockerfile");

    expect(dockerfile).toMatch(
      /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml \.\/\s*\nRUN pnpm install --frozen-lockfile/
    );
  });

  it("keeps local secrets and build artifacts out of the Docker context", () => {
    const dockerignore = readProjectFile(".dockerignore");

    expect(dockerignore).toMatch(/^\.env\*$/m);
    expect(dockerignore).toMatch(/^!\.env\.example$/m);
    expect(dockerignore).toMatch(/^\.git$/m);
    expect(dockerignore).toMatch(/^node_modules$/m);
    expect(dockerignore).toMatch(/^\.next$/m);
    expect(dockerignore).toMatch(/^coverage$/m);
    expect(dockerignore).toMatch(/^public\/uploads\/\*$/m);
    expect(dockerignore).toMatch(/^!public\/uploads\/\.gitkeep$/m);
    expect(dockerignore).toMatch(/^\.codebuddy$/m);
    expect(dockerignore).toMatch(/^\.workbuddy$/m);
  });

  it("requires explicit database credentials and uses a non-root app user", () => {
    const compose = readProjectFile("docker-compose.yml");

    expect(compose).toContain("MYSQL_USER: ${DB_USER:?DB_USER is required}");
    expect(compose).toContain("MYSQL_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}");
    expect(compose).toContain("MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD is required}");
    expect(compose).toContain("DATABASE_URL: ${APP_DATABASE_URL:?APP_DATABASE_URL is required}");
    expect(compose).not.toContain("mysql://${DB_USER");
    expect(compose).not.toMatch(/DB_ROOT_PASSWORD:-/);
  });

  it("keeps the trusted-proxy app port private and requires the cron secret", () => {
    const compose = readProjectFile("docker-compose.yml");
    const cronRoute = readProjectFile("src/app/api/cron/expire-orders/route.ts");
    const deploymentGuide = readProjectFile("docs/deployment.md");

    expect(compose).toContain('${APP_BIND_ADDRESS:-127.0.0.1}:3000:3000');
    expect(compose).toContain("TRUST_PROXY_HEADERS: ${TRUST_PROXY_HEADERS:-true}");
    expect(compose).toContain("CRON_SECRET: ${CRON_SECRET:?CRON_SECRET is required}");
    expect(compose).toContain("AUTH_SECRET: ${AUTH_SECRET:?AUTH_SECRET is required}");
    expect(compose).toContain("CARD_SECRET_SALT: ${CARD_SECRET_SALT:?CARD_SECRET_SALT is required}");
    expect(compose).toContain("AUTH_URL: ${AUTH_URL:?AUTH_URL is required}");
    expect(compose).toContain("SITE_URL: ${SITE_URL:?SITE_URL is required}");
    expect(compose).toContain("RATE_LIMIT_REQUIRE_REDIS: ${RATE_LIMIT_REQUIRE_REDIS:-true}");
    expect(cronRoute).not.toContain('searchParams.get("secret")');
    expect(deploymentGuide).toContain("/api/cron/expire-orders");
    expect(deploymentGuide).toContain("Authorization: Bearer");
  });

  it("passes payment gateway secrets only at runtime", () => {
    const dockerfile = readProjectFile("Dockerfile");
    const compose = readProjectFile("docker-compose.yml");

    const runtimePaymentVariables = [
      "ALIPAY_APP_ID",
      "ALIPAY_PRIVATE_KEY",
      "ALIPAY_PUBLIC_KEY",
      "ALIPAY_SELLER_ID",
      "ALIPAY_ENV",
      "ALIPAY_SANDBOX_GATEWAY",
      "ALIPAY_NOTIFY_URL",
      "WECHAT_APP_ID",
      "WECHAT_MCH_ID",
      "WECHAT_API_KEY",
      "WECHAT_API_V3_KEY",
      "WECHAT_V3_PUBLIC_KEY",
      "WECHAT_V3_PLATFORM_SERIAL",
      "WECHAT_NOTIFY_URL",
    ];

    for (const variable of runtimePaymentVariables) {
      expect(compose).toContain(`${variable}: \${${variable}:-}`);
      expect(dockerfile).not.toMatch(new RegExp(`(?:ARG|ENV)\\s+${variable}`));
    }
  });

  it("does not create or reset the known test user in production", () => {
    const seed = readProjectFile("prisma/seed.ts");

    expect(seed).toContain("if (!isProduction)");
    expect(seed).not.toMatch(/process\.env\.SEED_USER_PASSWORD\s*\|\|\s*["']/);
  });

  it("does not require a live database while building the sitemap route", () => {
    const sitemap = readProjectFile("src/app/sitemap.ts");

    expect(sitemap).toContain('export const dynamic = "force-dynamic"');
  });

  it("uses an internal origin for middleware self-checks in production", () => {
    const compose = readProjectFile("docker-compose.yml");
    const middleware = readProjectFile("src/middleware.ts");

    expect(compose).toContain("INTERNAL_SITE_URL: ${INTERNAL_SITE_URL:-http://127.0.0.1:3000}");
    expect(middleware).toContain("process.env.INTERNAL_SITE_URL?.trim() || origin");
    expect(middleware).toContain("getInternalRewriteUrl(req, rewritePath)");
    expect(middleware).toContain('getInternalRewriteUrl(req, "/maintenance")');
  });

  it("tests the configured Alipay environment instead of always using sandbox", () => {
    const script = readProjectFile("scripts/test-alipay-sandbox.mjs");

    expect(script).toContain('process.env.ALIPAY_ENV?.trim() === "production"');
    expect(script).toContain("https://openapi.alipay.com/gateway.do");
  });

  it("overrides vulnerable transitive build and test dependencies", () => {
    const workspace = readProjectFile("pnpm-workspace.yaml");
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const expectedOverrides = {
      postcss: "8.5.25",
      sharp: "0.35.3",
      esbuild: "0.25.12",
      vite: "6.4.3",
      "brace-expansion@<1.1.18": "1.1.18",
      "brace-expansion@>=2.0.0 <2.1.4": "2.1.4",
      "brace-expansion@>=4.0.0 <5.0.9": "5.0.9",
    };

    for (const [dependency, version] of Object.entries(expectedOverrides)) {
      expect(workspace).toContain(`${dependency}: ${version}`);
    }
    expect(packageJson.pnpm?.overrides).toEqual(expectedOverrides);
  });

  it("supports a git-pull, build, and npm-run-start deployment", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
      engines?: Record<string, string>;
    };
    const prepareScript = readProjectFile("scripts/prepare-standalone.mjs");
    const deploymentGuide = readProjectFile("docs/deployment.md");
    const gitignore = readProjectFile(".gitignore");

    expect(packageJson.scripts.build).toContain("scripts/prepare-standalone.mjs");
    expect(packageJson.scripts.start).toBe(
      "node --env-file=.env .next/standalone/server.js"
    );
    expect(packageJson.engines?.node).toBe(">=22.0.0");
    expect(prepareScript).toContain('resolve(root, ".next/static")');
    expect(prepareScript).toContain('resolve(root, ".next/standalone/.next/static")');
    expect(prepareScript).toContain('resolve(root, "public")');
    expect(prepareScript).toContain('resolve(root, ".next/standalone/public")');
    expect(deploymentGuide).toContain("pnpm install --frozen-lockfile");
    expect(deploymentGuide).toContain("pnpm run start");
    expect(deploymentGuide).toContain("npm run start");
    expect(deploymentGuide).toContain("前台进程");
    expect(deploymentGuide).toContain("宝塔 Node 项目");
    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});
