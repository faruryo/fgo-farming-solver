## Why

進捗比較（マシュの進捗レポート）で、実際には新規サーヴァントを入手していないのに「新しい仲間 457体ぶん +13,095,042 AP」のような巨大な幻の進捗APが表示される。原因は比較対象スナップショットに `material`（育成計算機の chaldea state）が保存されていないこと。`sync` spec は「ソルバー実行時にユーザーの localStorage **全体**を保存」と既に規定しているが、`/api/solve` は `{ items, quests }` だけを保存し material を欠落させており、**既存仕様に違反**している。この欠落スナップショットが material 入りのクラウド保存スナップショットを同日上書きで潰し、進捗比較を恒常的に破壊している。

## What Changes

- **ソルバー実行時のスナップショット保存をフル状態化**: 計算成功時にクライアントが `material`, `material/result`, `posession`, `items`, `quests` を含む localStorage 全体を `state_snapshots` に保存する。`/api/solve`（GET）のサーバ側 `{ items, quests }` のみのスナップショット保存は撤去する。クラウド KV（`cloud:<userId>`）は変更しない。
- **新規サーヴァント検出の安全弁**: 比較対象スナップショットに chaldea state（material）が存在しない（`null`）場合、新規サーヴァント検出は 0 件を返す。「disabled が true→false に変化」した遷移が観測できない以上、全所持サーヴァントを新規と誤判定しない。
- **BREAKING なし**: 既存の保存データ・API レスポンス形は維持。material を欠く既存スナップショットは安全弁により誤検出されなくなる（自然に正常化）。

## Capabilities

### New Capabilities
<!-- なし -->

### Modified Capabilities
- `sync`: ソルバー実行時のスナップショット保存シナリオを、`material` を含む localStorage 全体の保存を必須とする形に明確化し、material を欠くスナップショットで material 入りスナップショットを上書きしてはならない旨を追加する。
- `progress-visualizer`: 新規サーヴァント検出要件に、比較対象スナップショットが chaldea state を持たない場合は新規 0 件として扱う（誤検出を起こさない）シナリオを追加する。

## Impact

- `app/api/solve/route.ts`: サーバ側 `saveSnapshot({ items, quests })` 呼び出しを撤去。
- `components/farming/index.tsx`（`handleSubmit`）: 計算成功時にフル状態スナップショットを保存する経路を追加。
- スナップショット保存用エンドポイント（新規 or 既存 `/api/cloud` とは別系統）: localStorage 全体を受け取り `state_snapshots` のみへ日次上書き保存（cloud KV は触らない）。
- `lib/progress/tier.ts`（`detectNewServants`）: `past == null` のとき `[]` を返す安全弁。
- spec: `openspec/specs/sync/spec.md`, `openspec/specs/progress-visualizer/spec.md`。
- データ: `state_snapshots` テーブル（スキーマ変更なし、保存内容が full state になる）。
