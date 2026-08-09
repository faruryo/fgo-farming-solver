import { defineConfig, globalIgnores } from 'eslint/config'
import next from 'eslint-config-next'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import reactHooks from 'eslint-plugin-react-hooks'
import security from 'eslint-plugin-security'
import sonarjs from 'eslint-plugin-sonarjs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const compat = new FlatCompat({
  baseDirectory: dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([ruleId, value]) => {
      if (value === 'off' || value === 0) return [ruleId, value]
      if (Array.isArray(value)) return [ruleId, ['warn', ...value.slice(1)]]
      return [ruleId, 'warn']
    }),
  )

const externalImageAllowlist = [
  'components/common/possession-import/PossessionImportDialog.tsx', // OCR crops use in-memory object URLs.
  'components/dashboard/EventSection.tsx', // Atlas Academy event and item images are remote runtime data.
  'components/dashboard/GachaSection.tsx', // Atlas Academy servant and summon images are remote runtime data.
  'components/dashboard/RecentServantSection.tsx', // Atlas Academy servant faces are remote runtime data.
  'components/events/EventPlanResultCard.tsx', // Event currency/item icons are remote runtime data.
  'components/events/EventPlannerClient.tsx', // Event currency/item icons are remote runtime data.
  'components/farming/progress-report-content.tsx', // Servant face URLs are selected dynamically at runtime.
]

const intentionalHookDependencyAllowlist = [
  'components/events/EventPlannerClient.tsx', // The joined servant ID key is the deliberate invalidation boundary.
  'components/farming/index.tsx', // Legacy state adapters are not referentially stable; dependencies are intentionally narrowed.
  'components/quests/QuestEfficiencyList.tsx', // Derived option primitives explicitly define the calculation boundary.
  'hooks/use-dashboard-result.ts', // Transitive campaign inputs are listed as stable primitive invalidators.
  'hooks/use-excluded-quests.ts', // Legacy migration effect must run exactly once regardless of questIds identity.
  'hooks/use-local-storage.ts', // Storage subscriptions intentionally initialize only for the selected key.
  'hooks/use-spot-icons.ts', // The normalized quest ID key is the deliberate request invalidation boundary.
]

export default defineConfig([
  globalIgnores([
    'next.config.js',
    'postcss.config.mjs',
    'sentry.client.config.js',
    'sentry.server.config.js',
    'pages/_error.js',
    'next-env.d.ts',
    '.open-next/',
    '.wrangler/',
    'eslint.config.mjs',
    '.vercel/',
    '.next/',
    'public/',
    'reports/',
    '.claude/',
    '.codex/',
    '.agents/',
    '.agent/',
  ]),
  {
    linterOptions: {
      // Exceptions belong in the reasoned, file-scoped allowlists below.
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },

    extends: [
      ...next,
      ...compat.extends('eslint:recommended'),
      ...compat.extends('plugin:@typescript-eslint/recommended'),
      ...compat.extends('prettier'),
    ],

    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react-hooks': reactHooks,
      security,
      sonarjs,
    },

    settings: sonarjs.configs.recommended.settings,

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },

    rules: {
      // SonarJS and security start as debt-ratcheted warnings. Their full existing
      // inventories are visible, while new findings fail `pnpm lint:ratchet`.
      ...asWarnings(sonarjs.configs.recommended.rules),
      ...asWarnings(security.configs.recommended.rules),

      '@next/next/no-document-import-in-page': 'off',
      '@typescript-eslint/no-implied-eval': 'off',

      // Existing typed debt: visible and prevented from increasing by the ratchet.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { ignoreRestSiblings: true },
      ],

      // Zero-debt typed bug detectors. These are errors because the current
      // backlog is drained as part of this change.
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // React 19 migration debt is ratcheted rather than silently disabled.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',

      // Size and complexity debt is ratcheted. Tests keep logical complexity
      // checks, but their suite callbacks are exempted in the override below.
      'max-lines-per-function': [
        'warn',
        { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['warn', 20],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 6],
      'max-nested-callbacks': ['warn', 4],
    },
  },
  {
    // JavaScript build helpers are linted without constructing a TypeScript
    // Program; type-aware rules are owned by the TypeScript source set.
    files: ['**/*.mjs'],
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
    },
  },
  {
    // Next Image cannot optimize object URLs or arbitrary Atlas Academy URLs.
    files: externalImageAllowlist,
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: intentionalHookDependencyAllowlist,
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // The 30-day NEW marker deliberately snapshots the wall clock in a memo.
    files: ['hooks/use-quest-tree.ts'],
    rules: {
      'react-hooks/purity': 'off',
    },
  },
  {
    // This server page catches data-loading/DB failures before returning JSX;
    // React's render-time error-boundary rule is not the boundary in use here.
    files: ['app/farming/results/*/page.tsx'],
    rules: {
      'react-hooks/error-boundaries': 'off',
    },
  },
])
