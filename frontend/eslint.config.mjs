// Minimal flat config; phase-0 baseline. Will adopt next/core-web-vitals
// once eslint-config-next ships flat-config compatibility for ESLint 10.
import js from "@eslint/js"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import globals from "globals"

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      "public/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "@typescript-eslint": tsPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node, ...globals.es2024 },
    },
    rules: {
      // tsc + tsx already cover most of this. Keep eslint focused on
      // pure-JS-and-pattern issues we don't get from the compiler.
      "no-unused-vars": "off", // tsc handles this with noUnusedLocals
      "no-undef": "off",        // tsc handles globals
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off",
      // Plugin rule registered so inline `eslint-disable @typescript-eslint/...`
      // comments don't throw. We don't ENABLE it here; tsc owns this signal.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
]
