# FGO Farming Solver - Shared Agent Context

## Absolute Rules
- Do not hardcode credentials (API keys, passwords).
- Do not apply test data to production.
- Use `pnpm`, not `npm` or `yarn`.
- Do not add unverified dependencies.
- Follow the existing project structure (App Router).

## Stack Overview
- **Core**: Next.js App Router
- **Runtime**: Cloudflare Workers (OpenNext)
- **UI**: shadcn/ui + Tailwind CSS
- **Data**: lib/ & data/

## Deployment
- **Auto-deploy**: push to `main` → Cloudflare Workers Builds が自動でビルド & デプロイ。手動デプロイ不要。
- **Manual deploy**: `pnpm run deploy` は原則禁止。ローカルビルドの差異が本番に混入するリスクがあるため、明示的な指示がない限り実行しないこと。

## Key Commands
- `pnpm dev` — local dev server
- `pnpm run build` — Next.js build + OpenNext Cloudflare build
- `pnpm run deploy` — build + `wrangler deploy` to Cloudflare Workers
- `pnpm run lint` — ESLint
- `pnpm run type-check` — tsc --noEmit
- `pnpm run format` — Prettier
- `pnpm run seed:progress` — ローカルD1 SQLiteへの過去進捗ダミースナップショット注入（昨日・1週間前・1ヶ月前）。ローカル画面でカチカチとタブを切り替えてマシュの様々なセリフパターン（進捗量・育成成長・新サーヴァント入手）を検証可能。

## Global Gotchas
- Build is two-step: `next build && npx @opennextjs/cloudflare build --skipBuild`
- `wrangler.toml` uses `nodejs_compat` and `global_fetch_strictly_public`.
- **D1 Local Dev Fallback**: `/api/progress` API は、ローカル開発環境（`next dev`）でDB接続がない状態（ログイン後）で動作してもクラッシュせず、自動的に時間決定的なモック（`mocks/progress.json`）へフォールバックする例外保護が組み込まれています。
- **Unified Cache**: 高速化のため、`lib/data-source.ts` において Cloudflare Context (`env.MASTER_DATA`) がグローバルモジュールレベルでキャッシュされています。
- Refer to domain-specific rules for implementation details.

## OpenSpec Workflow
All implementation work MUST be done through OpenSpec to keep specs in sync with code.

- **Large changes** (new features, refactors): use `openspec new change <name>` → see `/opsx-propose` skill for details.
- **Small changes** (bug fixes, tweaks): edit `openspec/specs/<capability>/spec.md` directly, then run `openspec validate --specs`.
