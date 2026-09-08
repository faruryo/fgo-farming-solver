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
- **Data update jobs**: master-data / rarity の KV 更新は cron worker ではなく GitHub Actions の定期ワークフロー(`update-master-data.yml` 2時間ごと[rarity更新も統合実行] / `refresh-nice-war.yml` 12時間ごと / `send-todo-notifications.yml` 毎時)。Workers 無料プランは CPU 10ms 超の invocation を確率的に kill するため、**重い定期処理を Cloudflare cron worker に置かないこと**。詳細は `deployment_guide.md`。

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

## Code Review Rules (for ChatGPT Codex Connector & AI Reviewers)

### 1. Review Conduct & Anti-Fatigue Rules (レビューの進め方・小出し往復防止)

- **Exhaustive First-Pass (初回網羅・出し切り原則)**:
  - 指摘を複数回の往復にわたって小出し（drip-feed）にしてはならない。初回レビューで P1/P2 を含むすべての懸念・不整合・エッジケースを出し切ること。
  - 「1つ直されたら次の潜在バグを指摘する」モグラ叩きを禁止する。初回のコード・仕様全体の静的走査ですべて列挙する。
- **Cluster Systemic Issues (点ではなく面・ライフサイクル全体で指摘)**:
  - 単一の行や関数の局所的な指摘（Point finding）にとどめず、同一の不変条件に関わるデータフロー全体（入力・計算・表示・フィルタ・永続化・同期・テスト）を全走査し、関連箇所を1つの指摘グループ（影響箇所リスト付き）としてまとめて提示すること。
  - 例: 周回目的（育成/備蓄）や素材不足数の計算ロジックを変更する場合、該当箇所の計算だけでなく、結果表示・ヘッダー件数バッジ・不足フィルタ・ソルバー入力・アドバイザーの全箇所を一度に検証して影響箇所を網羅する。
- **Cross-artifact Impact (仕様変更時の波及先リスト同時提示)**:
  - 仕様やデータ構造、計算ロジック、UI 文言の変更を指摘する場合は、影響を受ける関連ファイル（`openspec/specs/`, `locales/ja.json`, `locales/en.json`, `types/`, 関連フック・コンポーネント、テスト等）の該当箇所リストを初回の指摘に必ず含めること。
- **Scope & Phase Discipline (PR 種別の尊重)**:
  - `docs:` や `openspec/` 配下のファイルのみを変更している PR（仕様策定・文書フェーズ）では、差分に含まれない既存コード（`app/`, `lib/` 等）への指摘を行わない。仕様ドキュメント内の論理的一貫性とエッジケースのみを検証する。
  - 製品/runtime 挙動を変更しない PR（CI、lint、開発ツール、agent 規約、文書、PR template 等）に対して OpenSpec 不足を指摘しない（OpenSpec は製品/runtime 挙動変更時のみ必須）。
- **No Mechanical Linting (CI 領域の除外)**:
  - ESLint、Prettier、TypeScript strict (`tsc --noEmit`)、warning ratchet (`pnpm run lint:ratchet`)、jscpd (`audit:duplicates`)、Knip (`audit:dead-code`) などの CI で機械的に検知できる事項（構文、フォーマット、使われていない変数、既存警告の残高等）は指摘しない。ドメイン不変条件、データ安全性、同期・状態整合性に集中すること。

### 2. High-Priority Domain Invariants (重点検証すべきドメイン不変条件)

- **Database & KV Security (本番データ保護とテスト分離)**:
  - 本番 D1 / KV へテスト・検証データを書き込む変更を BLOCKER とする。安全経路は local D1（`pnpm run seed:progress` 等）、mock（`mocks/progress.json`）、または明示された非本番 binding である。
  - D1 未接続のローカル開発環境（`next dev`）で `/api/progress` がクラッシュせず決定論的モックへフォールバックする例外保護を破壊・バイパスしてはならない。
- **Cloud Sync & Data Protection (クラウド同期と破壊的データ上書きの防止)**:
  - クラウド同期が未同期のローカル変更を無確認で上書きする、または大幅縮小 guard（サーヴァント数・所持アイテム種類数の半数以下激減、同期対象キー欠落等）を迂回する変更を BLOCKER とする。
  - 縮小判定はアイテムカタログなどの外部データ（マスターデータ）に依存せず、現行の同期対象キーおよび保存データのみで安全に判定できなければならない（マスターデータ取得失敗時でもキー欠落判定等で保護を継続する）。
  - 縮小検出時は「クラウドから復元」「見比べる」「このまま保存する」の3択経路を維持し、未解決のまま自動保存を予約させてはならない。
- **Data Licensing & Public Safety (公開データ境界とライセンス)**:
  - 未公開 FGO データ（ゲーム解析・リーク情報）や、再利用許諾を確認していない第三者データを公開レスポンスや静的マスターへ追加する変更を BLOCKER とする。公開時点・ライセンス・出典の境界を厳守する。
- **Farming Purpose & Deficiencies (周回目的と素材目標・不足計算の整合性)**:
  - 素材計算における「育成モード（training）」と「備蓄モード（reserve）」の境界を崩さないこと。
  - 備蓄モードでは所持数未入力の素材を不足計算に巻き込まず、有限目標計算（`computeFiniteTarget`）と不足判定・ヘッダー件数バッジ・フィルタ表示の整合性を維持すること。
  - ソルバー（`javascript-lp-solver`）への目的関数・制約条件の入力とドロップ率・AP 効率の整合性を維持すること。
- **Event Craft Advisor (料理作成アドバイザー / イベント計算の整合性)**:
  - 料理配分は完了パターンからの優先ソートやレア度ゾーン別期待値表示などの整理された仕様を維持し、廃止された「食材使い切り」等の非推奨パターンを再混入させないこと。

### 3. Runtime, State, UI & Testing Boundaries (実行環境・状態・UI・テスト設計境界)

- **Cloudflare Workers CPU 10ms Guard & Batch Jobs (実行環境制約)**:
  - 重い定期処理（master-data / rarity 更新、nice-war 更新、通知送信等）を Cloudflare cron Worker へ戻す変更を BLOCKER とする。Workers 無料プランの 10ms CPU 制限による確率的 kill を防ぐため、安全経路は GitHub Actions の定期ワークフローである。
  - `lib/data-source.ts` において Cloudflare Context (`env.MASTER_DATA`) がグローバルモジュールレベルでキャッシュされている前提を壊さないこと。
- **i18n Strictness (多言語対応と生キー露出防止)**:
  - 画面に表示される文字列は必ず `t('kebab-key', '日本語フォールバック')` を通す（BLOCKER。日本語・英語の直接ベタ書きは不可）。
  - 追加したキーは `locales/ja.json` と `locales/en.json` の両方に同時に追加し、テスト環境（`fallback ?? key`）で生キーが露出したままテストが通過しないよう、第2引数の日本語フォールバックを省略しないこと。
- **UI Verification & Orphan Route Prevention (画面実機検証とナビゲーション導線)**:
  - `app/**` や `components/**` の UI を変更した場合は、型チェックやユニットテストだけで完了とせず、ブラウザ実画面（レスポンシブ、375px 幅、ホバー、localStorage 永続等）での動作確認を必須とする。
  - 新規ルート（`app/**/page.tsx`）を追加した場合、URL 直打ちだけでなく `components/common/nav.tsx` 等の常設導線から到達できるようにすること（オーファンページの禁止）。
- **State & Storage Robustness (状態・localStorage 防御設計)**:
  - localStorage の読み書きにおいて、JSON パースエラーやキー未定義時に画面全体が白画面クラッシュしないよう、フォールバックや境界保護を維持すること。
- **Pure Logic & Testability (判断とI/Oの分離と回帰テストの妥当性)**:
  - 判定・計算・フィルタ等のドメイン判断は純粋関数として切り出し、Cloudflare binding、localStorage、時刻（`Date.now`）、乱数などの I/O 境界と分離すること。
  - 新規回帰テストは、条件反転等で実際に一度テストが赤くなることを確認してから通すこと。モックによりプロダクションコードの実行経路が形骸化していないか検証すること。
