import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import reactHooks from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores([
    "next.config.js",
    "sentry.client.config.js",
    "sentry.server.config.js",
    "pages/_error.js",
    "next-env.d.ts",
    "scripts/",
    "eslint.config.mjs",
    ".vercel/",
    ".next/",
    "public/",
]), {
    extends: [
        ...next,
        ...compat.extends("eslint:recommended"),
        ...compat.extends("plugin:@typescript-eslint/recommended"),
        ...compat.extends("prettier")
    ],

    plugins: {
        "@typescript-eslint": typescriptEslint,
        "react-hooks": reactHooks,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    rules: {
        "@next/next/no-document-import-in-page": "off",
        "@typescript-eslint/no-implied-eval": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unnecessary-type-assertion": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        // Disable new strict rules that block legacy patterns
        "react-hooks/set-state-in-effect": "off",
        "react-hooks/refs": "off",
        "react-hooks/immutability": "off",

        "@typescript-eslint/no-misused-promises": ["error", {
            checksVoidReturn: {
                attributes: false,
            },
        }],
    },
}]);