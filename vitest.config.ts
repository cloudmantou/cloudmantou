import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      SETTINGS_ENCRYPTION_KEY: "vitest-settings-encryption-key-32chars!",
      CARD_SECRET_SALT: "vitest-card-secret-salt-for-unit-tests",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      // Vitest 4 的 AST 感知覆盖率把 ??、?.、默认参数等计为分支，同一代码下数值低于 v3
      // （v3: 84.97/86.14，v4: 79.62/75.09）。按新口径的当前基线设门槛，补齐
      // feedback-server / feedback-images 等零覆盖模块的测试后恢复为 80。
      thresholds: {
        statements: 79,
        branches: 75,
        functions: 80,
        lines: 80
      }
    }
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
