# Design: 新クエストの既定選択と NEW バッジ

## 前提

`stable-short-ids` 実装済み（`id_registry` がペイロードに同梱され、IDが世代間で安定）。

## 1. サーバー側: `addedAt` の記録と露出

### `id_registry` 拡張（後方互換）

```ts
interface QuestIdEntry {
  id: string
  aa?: number
  addedAt?: string   // ISO 8601 日付。新規ID割当時に記録
}
```

- `assignQuestIds` が**新規IDを割り当てた瞬間のみ** `addedAt = 現在日付` を記録。再利用時は既存値を維持。
- `registryFromPrevious` の合成時（移行初回）は `addedAt` を付与しない → 既存全クエストが一斉に NEW になる事故を防ぐ。
- 既存レジストリに `addedAt` 無しエントリが混在しても単に「NEW表示なし」となるだけで安全。

### ペイロードへの射影

- `fetchAndTransformData` の最終段で、公開対象の各 Quest に `addedAt`（レジストリから引いた値）をコピー。
- `interfaces/fgodrop.ts` の `Quest` に `addedAt?: string` を追加。オプショナルのため既存消費者（solver・結果ページ・rarity-worker fingerprint 等)に影響なし。fingerprint には `addedAt` を**含めない**（追加日で再計算が走るのを防ぐ）。

## 2. クライアント側: 除外リスト反転

### 状態導出（`components/farming/index.tsx`）

```ts
const [excludedQuests, setExcludedQuests] = useLocalStorage<string[]>('excludedQuests', [])
const checkedQuests = useMemo(
  () => questIds.filter(id => !excludedSet.has(id)),
  [questIds, excludedQuests]
)
const setCheckedQuests = (updater) => {
  // checked semantics を受け取り、補集合を excludedQuests に保存するアダプタ
  // 併せて legacy 'quests' キーにもデュアルライト（snapshot / sync 契約の維持）
}
```

- `useChecked` / `useCheckboxTree` は「チェック済みリスト + setter」のインターフェースのまま → **変更不要**。
- URL クエリ反映（`?quests=` の展開）・`inputToQuery`・solve 送信はアダプタ経由で従来どおり checked semantics で動く。
- 除外リストに現データに存在しないIDが残っても無害（filter で自然に無視）。stable-short-ids 後はIDが動かないため腐敗しない。

### 移行（一方向・一回）

- マウント時: `localStorage('excludedQuests')` が無く `localStorage('quests')` が有る場合のみ `excluded = questIds − JSON.parse(quests)` を保存。
- `excludedQuests` が既に存在する場合は移行を再実行しない（クラウド復元で旧 `quests` が後から書かれても上書きしない）。
- クラウド同期: `KEYS` に `'excludedQuests'` を追加。復元（applyData）は全キー素通しのため特別対応不要。

## 3. UI: NEW バッジ

### 判定

```ts
const NEW_QUEST_WINDOW_DAYS = 30
const isNewQuest = (q: Quest) =>
  q.addedAt != null && Date.now() - Date.parse(q.addedAt) < NEW_QUEST_WINDOW_DAYS * 86400_000
```

### ツリーへの伝播（`hooks/use-quest-tree.ts`）

- `Node` 型（`components/common/checkbox-tree.tsx`）に `newCount?: number` を追加（汎用性維持のため ReactNode ではなく数値）。
- リーフ: `isNewQuest` なら `newCount: 1`。エリア/セクション: 子の `newCount` 合計を設定。
- `CheckboxTree` はラベル横に `newCount > 0` のとき shadcn `Badge` を描画:
  - リーフ: `NEW`
  - ブランチ（折りたたみ時の手がかり）: `NEW {count}`
  - 色は `var(--gold)` 系のアウトラインで既存トーンに合わせる。

### material 側の利用箇所

`components/material/material.tsx` も `useCheckboxTree` を使うが、`newCount` はオプショナルのため未設定なら従来表示。対応不要。

## エッジケース

| ケース | 挙動 |
|---|---|
| 移行初回（レジストリ合成） | 既存クエストに addedAt 無し → NEW ゼロから開始 |
| 新クエスト追加 | 既定でチェックON + リーフNEW + 祖先に件数バッジ |
| ユーザーが新クエストを外す | excludedQuests に入り、以後の更新でも外れ続ける |
| 全解除→全選択（リセット） | `onReset` は excluded を空にする（= 全選択） |
| 旧端末がクラウドから旧 'quests' のみ受信 | excludedQuests 既存なら無視。無ければ次回マウントで移行 |
