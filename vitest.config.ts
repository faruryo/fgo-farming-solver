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
      // Perf benchmarks assert on wall-clock time, which is meaningless
      // under the CPU contention of a parallel 58-file run (observed 3-5x
      // inflation). They run isolated via `pnpm test:perf`
      // (vitest.perf.config.ts).
      '**/*.perf.test.ts',
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
