import { defineConfig } from 'vitest/config'

// Isolated config for wall-clock perf benchmarks (`pnpm test:perf`).
//
// These files are excluded from the default suite (see vitest.config.ts):
// running them alongside 57 other test files saturates every core and
// inflates measurements 3-5x, which made the thresholds flake. Given a
// machine to themselves the same measurements are stable.
//
// Deliberately standalone rather than merged with vitest.config.ts — perf
// files use only core `expect` matchers, so they need neither the jest-dom
// setup nor the `@` alias.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.perf.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // One file at a time, even once more perf files exist.
    fileParallelism: false,
  },
})
