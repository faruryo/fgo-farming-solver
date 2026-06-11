# Tasks: new-quest-visibility

依存: `stable-short-ids` の実装完了後に着手。

## 1. サーバー側（addedAt）

- [x] 1.1 `lib/master-data/stable-ids.ts`: `QuestIdEntry.addedAt` を追加し、新規ID割当時のみ現在日付を記録（再利用時は維持、合成時は付与しない）
- [x] 1.2 `lib/master-data/update.ts`: 公開 Quest への `addedAt` 射影を追加
- [x] 1.3 `interfaces/fgodrop.ts`: `Quest.addedAt?: string` を追加
- [x] 1.4 rarity-worker の fingerprint 入力に `addedAt` が混入しないことを確認
- [x] 1.5 テスト: 新規割当で addedAt 記録・再利用で維持・合成で無し、の3ケースを `stable-ids.test.ts` に追加

## 2. クライアント側（除外リスト反転）

- [x] 2.1 `components/farming/index.tsx`: `excludedQuests` への反転アダプタ（checked semantics 維持・legacy `quests` デュアルライト）を実装
- [x] 2.2 同: 旧 `quests` キーからの一方向移行（`excludedQuests` 既存時はスキップ）
- [x] 2.3 `hooks/use-cloud-sync.ts`: `KEYS` に `excludedQuests` を追加
- [x] 2.4 リセット動作（`onReset`）が除外リストを空にすることを確認

## 3. UI（NEW バッジ）

- [x] 3.1 `components/common/checkbox-tree.tsx`: `Node.newCount?: number` を追加し、リーフ `NEW` / ブランチ `NEW {count}` バッジを描画
- [x] 3.2 `hooks/use-quest-tree.ts`: `addedAt` から `newCount` を算出しツリーへ伝播（30日定数は1箇所に集約）
- [x] 3.3 i18n 不要文言か確認（`NEW` は英字のまま）。スタイルは既存 gold トーンの Badge

## 4. 検証

- [x] 4.1 `pnpm test` / `pnpm run type-check` / `pnpm run lint` 通過
- [x] 4.2 モックの一部クエストに `addedAt`（直近日付）を付与し、dev でバッジ表示・バブルアップ・自動チェックONをブラウザで視認（push 前の視認必須）
- [x] 4.3 旧 `quests` キーのみ存在する状態からの移行で選択状態が保たれることを確認
- [x] 4.4 material ページのチェックボックスツリーが無変更で表示されることを確認
- [x] 4.5 `openspec validate new-quest-visibility` 通過
