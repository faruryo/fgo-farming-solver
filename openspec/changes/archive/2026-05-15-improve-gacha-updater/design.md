## Context

`lib/master-data/update.ts` の `fetchDashboardMeta()` が Cloudflare Worker の Cron Trigger から呼び出され、ガチャ・イベント・サーヴァントデータを KV に保存している。現状の問題点：

1. **バナー URL バグ**: `/JP/Banner/summon_{id}.png`（404）→ 正しくは `/JP/SummonBanners/img_summon_{id}.png`
2. **イベント N+1 フェッチ**: `basic_event.json`（軽量）でフィルタ後、各イベントを個別に `/nice/JP/event/{id}` で取得。アクティブイベントが多いと遅延・レート制限リスクあり
3. **モック手動管理**: `mocks/dashboard.json` を手動で更新しており、ローカル開発時のデータが古くなりやすい

## Goals / Non-Goals

**Goals:**
- ガチャバナー URL バグの修正（本番影響）
- `fetchDashboardMeta()` のイベント取得を一括フェッチに改善
- `mocks/dashboard.json` を自動生成するスクリプトの追加

**Non-Goals:**
- `fetchAndTransformData()`（ドロップデータ取得）は変更しない
- ガチャの確率テーブル・プール一覧の取得（Atlas API に存在しない）
- Cloudflare Worker の実行スケジュール変更

## Decisions

### バナー URL 修正

`staticOrigin + '/JP/SummonBanners/img_summon_' + imageId + '.png'` に変更。  
Atlas Academy CDN の実際のパス構造に合わせる。`/JP/Banner/` パスは存在しない（全件 404 確認済み）。

### イベント取得の一括化

現状：`basic_event.json` でフィルタ → 各イベントを `/nice/JP/event/{id}` で個別取得  
変更後：`export/JP/nice_event.json`（全イベント一括、約数 MB）を1リクエストで取得してメモリ内フィルタ

**トレードオフ**: `nice_event.json` は大きい（数MB）が、Worker の無料メモリ（128MB）に収まる。個別フェッチの N+1 と比べて合計レイテンシを大幅削減できる。

### ガチャフィルタ条件

現状：`g.pickupId > 0`  
変更後：`g.type === 'stone' || g.type === 'chargeStone'` で限定ガチャのみ表示し、フレポ召喚を除外。`pickupId` はデータによって 0 になることがあり不安定。

### モック自動生成スクリプト

`scripts/update-mock-dashboard.ts` を新規追加。`fetchDashboardMeta()` を直接呼び出し、結果を `mocks/dashboard.json` に書き出す。`package.json` に `"update:mock:dashboard": "tsx scripts/update-mock-dashboard.ts"` を追加。

## Risks / Trade-offs

- `nice_event.json` のサイズが将来的に増大し Worker メモリを圧迫するリスク → その時点で個別フェッチに戻す（現状問題なし）
- バナー URL 変更は既存の KV キャッシュを即時に無効化しない → 次回 Cron 実行時（通常24時間以内）に自動更新される
