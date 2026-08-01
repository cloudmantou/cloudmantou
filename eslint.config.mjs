import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // Next 16 enables additional strict hooks rules. The existing React 18
      // codebase needs a dedicated refactor before these can become blockers.
      // Keep the established hooks correctness rules enabled in the meantime.
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "node_modules/**",
    "public/uploads/**",
    "next-env.d.ts",
  ]),
]);
