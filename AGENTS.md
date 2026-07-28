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
- `pnpm run lint:ratchet` — 既存lint警告のファイル・ルール別ベースラインから増加がないことを確認
- `pnpm run audit:duplicates` — jscpd重複レポート（report-only）
- `pnpm run audit:dead-code` — Knip未使用候補レポート（report-only）
- `pnpm run type-check` — tsc --noEmit
- `pnpm run format` — Prettier
- `pnpm run seed:progress` — ローカルD1 SQLiteへの過去進捗ダミースナップショット注入（昨日・1週間前・1ヶ月前）。ローカル画面でカチカチとタブを切り替えてマシュの様々なセリフパターン（進捗量・育成成長・新サーヴァント入手）を検証可能。

## Global Gotchas
- Build is two-step: `next build && npx @opennextjs/cloudflare build --skipBuild`
- `wrangler.toml` uses `nodejs_compat` and `global_fetch_strictly_public`.
- **D1 Local Dev Fallback**: `/api/progress` API は、ローカル開発環境（`next dev`）でDB接続がない状態（ログイン後）で動作してもクラッシュせず、自動的に時間決定的なモック（`mocks/progress.json`）へフォールバックする例外保護が組み込まれています。
- **Unified Cache**: 高速化のため、`lib/data-source.ts` において Cloudflare Context (`env.MASTER_DATA`) がグローバルモジュールレベルでキャッシュされています。
- **i18n**: 画面に出る文字列は必ず `t('kebab-key', '日本語フォールバック')` で書く（日本語のベタ書きも違反）。詳細は `.agents/rules/ui-conventions.instructions.md`。
- **Testing**: テスト追加・既存ロジックのテスタビリティ改善前に `.agents/rules/testing.instructions.md` を読む。pure関数、依存注入、ケース表、テストが実際に赤くなる確認を定義している。
- Refer to domain-specific rules for implementation details.

## OpenSpec Workflow
Product or runtime behavior changes MUST be done through OpenSpec to keep specs in sync with code.

Repository-only maintenance that does not change product/runtime behavior—such as CI, lint, developer tooling, agent instructions, documentation, or PR templates—does not require an OpenSpec change. If a change mixes maintenance with product behavior, apply OpenSpec to the product/runtime portion.

- **Large product changes** (new features, behavior-changing refactors): use `openspec new change <name>` → see `openspec-propose` skill for details.
- **Small product changes** (bug fixes, behavior tweaks): edit `openspec/specs/<capability>/spec.md` directly, then run `openspec validate --specs`.

## Code Review Rules

- 本番D1/KVへテスト・検証データを書き込む変更をBLOCKERとする。安全経路はlocal D1、mock、または明示された非本番bindingである。
- クラウド同期が未同期のローカル変更を無確認で上書きする、または大幅縮小guardを迂回する変更をBLOCKERとする。復元・比較・明示確認の経路を維持する。
- 未公開FGOデータや、再利用許諾を確認していない第三者データを公開レスポンスへ追加する変更をBLOCKERとする。公開時点・ライセンス・出典の境界を確認する。
- UI文言が `t('kebab-key', '日本語フォールバック')` を通らない変更を指摘し、日英localeキーとテストmockを同時に確認する。
- 重い定期処理をCloudflare cron Workerへ戻す変更をBLOCKERとする。安全経路はGitHub Actionsの定期workflowである。
- OpenSpec不足を指摘するのは製品/runtime挙動の変更時に限る。CI、lint、開発ツール、agent規約、文書、PR templateだけの変更は対象外とする。
