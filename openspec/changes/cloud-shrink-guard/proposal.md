## Why

6/15〜7/24 にかけて、本番のクラウドデータが繰り返しゼロ相当まで潰された。スマホ側で復元が走らず `createChaldeaState` の既定値(462騎・全 `disabled: true`)が localStorage に書かれ、それをオートセーブがそのままクラウドへ保存して本物を上書きしていた。

PR #18 はこの連鎖の入口 —「空データを作らせない」側 — を塞いだ。しかし出口、すなわち**空同然のデータをクラウドへ保存させない**防御は無いままで、有効目標 461→0 / 所持 104→0 という保存が何のチェックも無く通る。7/10 には 1.2KB まで縮んだ保存も記録されている。

#18 の後も塞がっていない典型は「同期済み端末で `material` だけが初期化される」型である。メタデータは正常なので divergent 判定にはかからず、オートセーブが素通りさせる。本 change はこの二段目の防御を入れる。

## What Changes

- 保存直前のペイロードとクラウドの現行値を比較し、極端な縮小を検出する純関数 `lib/cloud-sync/shrink-guard.ts` を新設する。指標は有効サーヴァント件数・所持アイテム種類数・同期対象キーの欠落件数の3つ。
- 検出時はオートセーブ・手動保存とも中断し、`components/cloud/shrink-guard-dialog.tsx` で「クラウドから復元 / 見比べる / このまま保存する」を選ばせる。既定は復元。
- 比較の基準値(クラウドの現行値)が取得できない場合は保存を中止する(素通りさせない)。
- `handleSave` に `allowShrink` オプションを追加する。既存の `force` 引数(コンフリクトのバイパス)とは**分ける**。`/cloud` の「強制上書き」は `force: true` を渡すため、同じフラグを読むとこのガードを素通りしてしまう。

## Non-goals

- 段階的な減少の検知。保存のたびに基準値も下がるため原理的に追えない。ユーザーの意図した操作と区別できないので狙わない。
- 素材の「個数」の減少検知。指標は種類数に留める(理由は design.md)。
- サーバ側での拒否。実行犯はアプリ自身のオートセーブでありクライアントで塞げる。`/api/cloud` POST は毎回 D1 スナップショットを残すので復旧証跡は別途担保される。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
- `sync`: クラウド保存時の破壊的縮小の検出と、ユーザーによる解決手段を追加する。

## Impact

- `lib/cloud-sync/shrink-guard.ts`(新規) / `lib/cloud-sync/shrink-guard.test.ts`(新規)
- `components/cloud/shrink-guard-dialog.tsx`(新規) / 同 test(新規)
- `hooks/use-cloud-sync.ts`(`handleSave` へのガード組み込み、pending 状態の公開)
- `components/cloud/sync-engine.tsx`(ダイアログの常駐)
- `locales/`(ダイアログ文言)
- `openspec/specs/sync/spec.md`
