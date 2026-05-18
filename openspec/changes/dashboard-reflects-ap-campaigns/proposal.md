## Why

現状の `solver` 仕様には「AP 半減キャンペーンを最適化計算に反映する」と書かれているが、実装は存在せず、また既存仕様のまま実装すると `total_ap` の意味がキャンペーンの有無で揺らぎ、`progress-visualizer` の KPI（残ファーミング量の指標）が安定しなくなる問題がある。

加えて、AP 半減キャンペーンはユーザーの周回判断を直接動かす重要情報で、トップページの「達成間近の素材」「周回予定クエスト」に反映されていないとユーザーが古い前提で行動してしまう。Atlas Academy の `nice_event.json` 経由でキャンペーン情報が機械可読に取得可能なことが調査で確認できたため、データ取得経路とソルバーの呼び分け方針を整理し直して、トップページに反映する。

## What Changes

- master-data 更新パイプラインで `nice_event.json` から `target=questAp` のキャンペーンを抽出し、`aaQuestId` 経由でアプリ内 quest ID にマッピングして drops バンドルに同梱する。
- ソルバーに「キャンペーン適用モード」のスイッチを導入し、保存される計算結果（履歴 / snapshot）には適用前の値（nominal AP）を、ダッシュボード表示にはクライアント側で再計算した適用後の値（effective AP）を使う方針に揃える。
- ダッシュボードの「達成間近の素材」「周回予定クエスト」は、保存結果ではなく、現在時刻で有効なキャンペーンを反映してクライアント側で再計算した結果を表示する。これによりキャンペーンが計算実行後に開始された場合でも反映される。
- HTTP / クライアント / ソルバー結果の 3 層キャッシュを導入し、再計算コストとキャンペーン反映遅延のバランスを取る。
- 性能リグレッション検知のため、ソルバーのベンチマークを継続的なテストとして残す。
- **BREAKING**: `solver` 仕様の「AP 半減キャンペーンの適用」シナリオを差し替える（同一クエストの AP を直接半分にする旧文言を撤回し、適用モードと nominal/effective AP の分離方針に置き換える）。
- 進捗ビジュアライザー (`progress-visualizer`) の KPI を厳密にキャンペーン非依存にする変更は、今回のスコープには含めない（差分が item-count ベースで計算されており現時点で大きく崩れないため、別 change で扱う）。

## Capabilities

### New Capabilities
（なし。既存 capability への追加・修正のみ）

### Modified Capabilities
- `solver`: キャンペーン適用モード（applyCampaigns）の導入と、旧「AP 半減キャンペーンの適用」シナリオの差し替え
- `master-data`: `nice_event.json` から AP キャンペーン情報を抽出し drops バンドルに含める要件の追加
- `dashboard`: 「達成間近の素材」「周回予定クエスト」がキャンペーン反映済みの結果を表示する要件の追加、および反映遅延に関する開示の追加

## Impact

- **コード**
  - `lib/master-data/update.ts`（または updater-worker 側）: `nice_event.json` からの campaign 抽出ロジックを追加
  - `lib/get-drops.ts` / `interfaces/fgodrop.ts`: drops バンドルに `campaigns` (または quest 単位の modifier) を追加
  - `lib/solver.ts`: `applyCampaigns` オプションの追加。実効 AP の算出経路追加
  - `hooks/use-drops.ts`: モジュールレベルキャッシュ化
  - `app/api/drops/route.ts`: `Cache-Control: max-age=300, stale-while-revalidate=3600` 系へ移行
  - `components/dashboard/NearGoalSection.tsx`, `components/dashboard/RecommendedQuest.tsx`: 表示用結果をクライアント再計算版に切替（共通フック経由）
  - `lib/solver-perf.test.ts`: パフォーマンスリグレッション用に保持

- **データ / 永続化**
  - `MASTER_DATA` KV の `all_drops_json` ペイロード形状が後方互換的に拡張される（`campaigns` フィールド追加）
  - 計算履歴 (`farming_results` D1) と snapshot は引き続き nominal AP を保存（破壊的変更なし）

- **外部依存**
  - Atlas Academy `nice_event.json` の `campaigns` / `campaignQuests` フィールドへの依存追加（既に同 JSON を fetch しているので新規 fetch は不要）

- **UX**
  - ダッシュボードに、キャンペーン反映に最大 ~30 分の遅延が発生する旨の小さな開示を追加
