import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*": ["./*"] path alias, used by
    // components/**/*.tsx imports of components/ui/* (shadcn).
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // Default environment stays 'node' so existing pure-function tests
    // (lib/**, scripts/**, hooks/**) keep their fast, DOM-free behavior.
    // Component tests opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.claude/**',
      '**/.codex/**',
      '**/.agents/**',
      '**/.agent/**',
    ],
  },
})
