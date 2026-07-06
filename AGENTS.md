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
- **Auto-deploy**: push to `main` → GitHub Actions(`.github/workflows/deploy.yml`)が自動でビルド & デプロイ。手動デプロイ不要。
- **Manual deploy**: `pnpm run deploy` は原則禁止。ローカルビルドの差異が本番に混入するリスクがあるため、明示的な指示がない限り実行しないこと。
- **Data update jobs**: master-data / rarity の KV 更新は cron worker ではなく GitHub Actions の定期ワークフロー(`update-master-data.yml` 30分ごと / `update-rarity-tables.yml` 毎時 / `refresh-nice-war.yml` 6時間ごと)。Workers 無料プランは CPU 10ms 超の invocation を確率的に kill するため、**重い定期処理を Cloudflare cron worker に置かないこと**。詳細は `deployment_guide.md`。

## Analytics / 利用状況分析
- 本番の利用者数・人/ボット・機能の使われ方を調べる手段と制約は `analytics_guide.md` を参照。要点: **Workers Logs(UA/IP/ボット判定)は約7日しか残らない**・`farming_results` に UA/IP は無い・未ログインは全員 `anonymous` に潰れる・ローカル検証は本番 D1 を汚さない(local/prod は `batch_id` 列の有無で見分け)。継続分析には保存時シグナル記録(案B)等の追加が必要。

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

- **Large changes** (new features, refactors): use `openspec new change <name>` → see `openspec-propose` skill for details.
- **Small changes** (bug fixes, tweaks): edit `openspec/specs/<capability>/spec.md` directly, then run `openspec validate --specs`.
