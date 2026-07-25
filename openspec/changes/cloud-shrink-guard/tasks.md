## 1. 判定ロジック

- [ ] 1.1 `lib/cloud-sync/shrink-guard.ts` を新設し、`measurePayload(storage): PayloadScale | null`(`servants` / `possessions`)と `findMissingKeys(next, cloud, keys): string[]`(判定は `KEYS ∩ cloud.storage`、発火は2件以上)、`isDestructiveShrink(next, cloud, missingKeys): boolean` を実装する
- [ ] 1.2 `lib/cloud-sync/shrink-guard.test.ts` に design.md §8 の表のケースを実装する(事故フィクスチャを含む)

## 2. フックへの組み込み

- [ ] 2.1 `handleSave` に `options?: { allowShrink?: boolean }` を追加する(既存の `force` 引数は変更しない)
- [ ] 2.2 `dataObj` 組み立て直後にガードを挿入する。`session != null` のときのみ適用し、`cloudData` が `null` なら `fetchCloudData()` を1回待ち、なお `null` なら `saveStatus: 'failed'` で中止する
- [ ] 2.3 測定不能(`measurePayload` が `null`)のとき中止する
- [ ] 2.4 pending 状態をモジュールスコープに置き、変更通知イベントでインスタンス間に伝播させる。フックから `pendingShrink` と解決用ハンドラを公開する
- [ ] 2.5 pending がある間は変更リスナーで自動保存の debounce を再武装しない
- [ ] 2.6 復元・強制保存のいずれでも `pendingShrink` を解除して通知する
- [ ] 2.7 `hooks/use-cloud-sync.test.ts` に design.md §8 のフック側5項目を追加する

## 3. UI

- [ ] 3.1 `components/cloud/shrink-guard-dialog.tsx` を新設する(3択・既定は復元・「このまま保存する」は destructive)
- [ ] 3.2 `components/cloud/sync-engine.tsx` に常駐させる
- [ ] 3.3 `locales/` に文言を追加する(ja / en)
- [ ] 3.4 `components/cloud/shrink-guard-dialog.test.tsx` で3ボタンの動作を確認する

## 4. 検証

- [ ] 4.1 `pnpm exec vitest --run hooks/ lib/cloud-sync/ components/cloud/`
- [ ] 4.2 type-check
- [ ] 4.3 ブラウザ実機確認: `localhost:3000` でモッククラウドを使い、縮小保存を起こしてダイアログの3ボタンをそれぞれ検証する(`127.0.0.1` は `allowedDevOrigins` 外でハイドレーションしない)
- [ ] 4.4 `openspec validate cloud-shrink-guard`
