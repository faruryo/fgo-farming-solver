## Why

`fetchDashboardMeta()` のガチャバナーURLが `/JP/Banner/summon_{id}.png` という存在しないパスを使っており、本番でガチャバナーが全件 404 になっている。また、イベント詳細の取得が N+1 リクエストになっており更新速度が遅く、開発環境ではモックデータを手動で更新する必要がある。

## What Changes

- **BREAKING** ガチャバナー URL を `/JP/SummonBanners/img_summon_{imageId}.png` に修正
- イベント取得を `basic_event.json` + 個別フェッチ（N+1）から `export/JP/nice_event.json` の一括取得に変更し、リクエスト数を削減
- ガチャフィルタ条件を `pickupId > 0` から `type === 'stone' || type === 'chargeStone'` に変更し、フレポ系を除外しつつより正確に絞り込む
- `mocks/dashboard.json` を Atlas Academy API から自動生成するスクリプト（`scripts/update-mock-dashboard.ts`）を追加

## Capabilities

### New Capabilities
- `mock-dashboard-updater`: `mocks/dashboard.json` を現在開催中のガチャ・イベントデータで自動更新する開発用スクリプト

### Modified Capabilities
- `master-data`: `fetchDashboardMeta()` のガチャ取得ロジック（バナー URL・フィルタ条件・イベント取得方法）の変更
- `dashboard`: GachaSection のピックアップサーヴァントに `/material#svt-{id}` へのリンクを追加
- `material`: ServantCard のポートレート（アイコン）クリックでサーヴァント詳細ページへ遷移

## Impact

- `lib/master-data/update.ts` — `fetchDashboardMeta()` の修正
- `scripts/update-mock-dashboard.ts` — 新規スクリプト追加
- `mocks/dashboard.json` — スクリプトで自動生成対象に
- `package.json` — `update:mock` スクリプトコマンド追加
