## 1. 判定ロジック

- [x] 1.1 `lib/cloud-sync/shrink-guard.ts` を新設し、`measurePayload(storage): PayloadScale | null`(`servants` / `possessions`)と `findMissingKeys(next, cloud, keys): string[]`(判定は `KEYS ∩ cloud.storage`、発火は2件以上)、`isDestructiveShrink(next, cloud, missingKeys): boolean` を実装する
- [x] 1.2 `lib/cloud-sync/shrink-guard.test.ts` に design.md §9 の表のケースを実装する(事故フィクスチャを含む)

## 2. フックへの組み込み

- [x] 2.1 `handleSave` に `options?: { allowShrink?: boolean }` を追加する(既存の `force` 引数は変更しない)
- [x] 2.2 `dataObj` 組み立て直後にガードを挿入する。`session != null` のときのみ適用し、`cloudData` が `null` なら `fetchCloudData()` を1回待ち、なお `null` なら `saveStatus: 'failed'` で中止する
- [x] 2.3 測定不能(`measurePayload` が `null`)のとき中止する
- [x] 2.4 pending 状態をモジュールスコープに置き、変更通知イベントでインスタンス間に伝播させる。フックから `pendingShrink` と解決用ハンドラを公開する
- [x] 2.5 pending がある間は変更リスナーで自動保存の debounce を再武装しない
- [x] 2.6 復元・強制保存のいずれでも `pendingShrink` を解除して通知する
- [x] 2.7 `hooks/use-cloud-sync.test.ts` に design.md §9 のフック側5項目を追加する

## 3. UI

- [x] 3.1 `components/cloud/shrink-guard-dialog.tsx` を新設する(3択・既定は復元・「このまま保存する」は destructive)
- [x] 3.2 `components/cloud/sync-engine.tsx` に常駐させる
- [x] 3.3 `locales/` に文言を追加する(ja / en)
- [x] 3.4 `components/cloud/shrink-guard-dialog.test.tsx` で3ボタンの動作を確認する

## 4. `/cloud` の保留表示

- [x] 4.1 `blockedShrink`(保存が止まっている事実)を `pendingShrink`(ダイアログの表示制御)と分けてフックから公開する。「見比べる」は dismiss を伴うため、後者を見ていると遷移先が素通しになる
- [x] 4.2 `components/cloud/index.tsx` で保留中に「同期は正常です」を出さず、保留中である旨・`読み込み` / `このまま保存する`・最終保存日時と端末を出す。オートセーブのトグルは無効化する
- [x] 4.3 `hasConflict` と保留が同時に立つとき、保留側を優先する
- [x] 4.4 `lib/cloud-sync/storage-diff.ts`(新規)に `diffPossessions` / `diffKeys` を実装し、テストを書く
- [x] 4.5 `components/cloud/parts/shrink-diff.tsx`(新規)で減る素材(上位10件 + ほか N 件)とキー単位の内訳を描画し、テストを書く
- [x] 4.6 比較表とキー単位の内訳で数え方が異なることを注記する
- [x] 4.7 `components/cloud/index.test.tsx` で保留時の表示と解決手段を確認する

## 5. 検証

- [x] 5.1 `pnpm exec vitest --run hooks/ lib/cloud-sync/ components/cloud/`
- [x] 5.2 type-check
- [x] 5.3 ブラウザ実機確認: `localhost:3000` でモッククラウドを使い、ダイアログの3ボタンと `/cloud` の保留表示・差分・読み込みを検証する(`127.0.0.1` は `allowedDevOrigins` 外でハイドレーションしない)
- [x] 5.4 `openspec validate cloud-shrink-guard`
