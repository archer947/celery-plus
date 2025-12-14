// Migrated ESLint config for v9+
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import mocha from "eslint-plugin-mocha";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  { ignores: ["dist/**", "examples/**"] },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        // Node.js built-ins
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        require: "readonly",
        module: "readonly",
        URL: "readonly",
        NodeJS: "readonly",
        // Mocha globals for test files
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        after: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      mocha,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettier.rules,
      "no-console": 0,
      "@typescript-eslint/camelcase": 0,
      "@typescript-eslint/no-explicit-any": 0,
      "mocha/no-exclusive-tests": "error",
      "prefer-rest-params": "off",
      "max-len": ["error", { code: 200, ignoreComments: true }],
    },
  },
];
