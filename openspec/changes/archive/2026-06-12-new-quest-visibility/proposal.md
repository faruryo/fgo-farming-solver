## Why

クエスト選択の保存形式は「チェック済みIDリスト」のため、一度でも選択を保存したユーザーには**新規追加クエストが自動的に未選択**になる。新しい高効率クエスト（新章フリクエ・冠位研鑽戦の新階層など）が計算から黙って漏れ続け、ユーザーは追加に気づく手段もない。クエストツリーは Section → Area → Quest の折りたたみ式で、新クエストは畳まれたエリア内に埋もれて見えない。

`stable-short-ids` でIDが世代間安定になる前提が整うため、その上に「新クエストの既定選択」と「鮮度の可視化」を載せる。

## What Changes

- **保存形式の反転（除外リスト方式）**
  - `localStorage('quests')`（チェック済みリスト）→ `localStorage('excludedQuests')`（除外リスト）に反転。チェック状態は `全クエスト − 除外` で導出。
  - これにより**新クエストは既定でチェックON**になり、ユーザーが意図的に除外したクエストだけが外れ続ける。
  - 初回マウント時に旧 `quests` キーから一方向移行（`excluded = 全ID − 保存済みチェックID`）。スナップショット/同期の既存契約のため `quests` キーへのデュアルライトは維持。
  - クラウド同期 `KEYS` に `excludedQuests` を追加。
- **NEW バッジによる鮮度可視化**
  - `stable-short-ids` の `id_registry` に新ID割当時の `addedAt`（ISO日付）を記録し、公開ペイロードの `Quest.addedAt` として露出。
  - クエスト選択ツリーで `addedAt` が **30日以内**のクエストに NEW バッジを表示。
  - 折りたたみ対策として、配下に NEW クエストを含むエリア/セクションノードにも件数付きバッジ（例: `NEW 3`）をバブルアップ表示。
  - 移行初回（レジストリ合成時）の既存クエストには `addedAt` を付与しない → 既存クエストが一斉に NEW にならない。

## Dependencies

- `stable-short-ids` が先行（`id_registry` 基盤と ID 安定性が前提。IDが不安定なままだと移行した除外リスト自体がまた壊れる）。

## Non-goals

- 新アイテムの可視化（アイテム入力欄は需要入力であり選択ではないため対象外）。
- NEW バッジ期間のユーザー設定化（30日固定。定数1箇所で変更可能にはする）。
- 既読管理（クリックでNEWを消す等のper-user状態）は持たない。`addedAt` ベースの決定的表示のみ。

## Capabilities

### Modified Capabilities
- `master-data`: `id_registry` への `addedAt` 記録と `Quest.addedAt` の露出
- `sync`: 同期対象キーへの `excludedQuests` 追加と旧形式からの移行
- `solver`: クエスト選択UI（段階的開示の一部）における新クエストの既定選択と NEW バッジ表示

## Impact

- `lib/master-data/stable-ids.ts`（`QuestIdEntry.addedAt` 追加・割当時刻記録）
- `lib/master-data/update.ts`（`Quest.addedAt` への射影）/ `interfaces/fgodrop.ts`（`Quest` 型）
- `components/farming/index.tsx`（除外リスト反転アダプタ・移行・デュアルライト）
- `hooks/use-quest-tree.ts` / `components/common/checkbox-tree.tsx`（Node への `badge` 拡張と表示）
- `hooks/use-cloud-sync.ts`（`KEYS` 追加）
- i18n / スタイル（NEW バッジ）
