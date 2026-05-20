## Why

`fgo-data-updater` worker は毎時 cron で `fetchAndTransformData()` と `fetchDashboardMeta()` を実行している。観測ログを集計すると、過去 24h で cron 実行の約半数が `exceededCpu` で失敗していた。原因は `fetchAndTransformData()` 内の `nice_war.json`（≈23MB）取得・JSON.parse・15,000 件規模の flatMap で、Cloudflare 側の subrequest 含む累積コスト上限を踏んでいる模様（成功 run でも CPU は 1.7s 程度しか使っていないので CPU 時間そのものではなく、ランタイム内部の subrequest／コールドスタート系の上限）。

頻度を下げてもこの上限を踏む確率は変わらず、本質的な対策にならない。一方、現状の実装には別の脆弱性がある:

- Atlas が空配列を返したり、スプレッドシートが取得できなかったケースで `fetchAndTransformData()` / `fetchDashboardMeta()` は throw せず「中身がほぼ空のオブジェクト」を返し、それを KV に上書き保存してしまう

結果として、2026-05-20 に新召喚が開幕した際、cron が連続失敗してダッシュボードに「開催中の召喚 0 件」表示が 2 時間続いた。

## What Changes

- **KV 上書き前のバリデーション層を新設**
  - `validateMasterData` / `validateDashboardMeta` を `lib/master-data/validation.ts` に追加
  - drops は `items` / `quests` / `drop_rates` のいずれかが空ならスキップ
  - dashboard meta は `events` と `gachas` が両方空ならスキップ（片方空はガチャ無し期間として有効）
  - スキップ時はログを残し、既存 KV データ（直近の正常値）を温存
- **`updateMasterData` を `updateDrops` / `updateDashboardMeta` の 2 関数に分離**し、try/catch を関数単位に縮小（片方失敗が他方に波及しないように）
- **手動 HTTP `/update` エンドポイントは削除**（cron 専用とし、緊急時は Cloudflare ダッシュボードの "Trigger Cron" を使う）
- **cron スケジュールは変更しない**（毎時 1 本）

## Capabilities

### New Capabilities
（なし）

### Modified Capabilities
- `master-data`: 「失敗・空応答時の KV 保護」要件を新規追加（既存要件は変更しない）

## Impact

- `updater-worker/index.ts`: `fetch` ハンドラを削除、`updateDrops` / `updateDashboardMeta` に分割、KV 書き込み前バリデーション
- `lib/master-data/validation.ts`（新規）と `validation.test.ts`（新規）
- `deployment_guide.md`: 手動更新の説明を更新（CF ダッシュボードでの cron 手動発火に書き換え）
- cron スケジュール（`updater-worker/wrangler.toml`）は変更なし
