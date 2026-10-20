import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    // CommonJS Passenger entrypoint — `require()` is intentional here.
    "server.js",
  ]),
  {
    rules: {
      // The codebase predates strict typing; keep `any` visible without
      // failing the build until it is fully typed.
      "@typescript-eslint/no-explicit-any": "warn",
      // React 19 / React Compiler rules the existing code predates. Keep them
      // visible as warnings; none are correctness bugs for this app.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      // Stylistic JSX rules — not security issues (React escapes output).
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
]);
