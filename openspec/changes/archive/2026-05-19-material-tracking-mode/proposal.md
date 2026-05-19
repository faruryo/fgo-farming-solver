## Why

`/material` ページでサーヴァントの現在値（再臨/スキル/アペンドの `start`）を変更したとき、本来は対応する素材を消費したはずだが、`/material/result` の所持数（`localStorage['posession']`）には反映されない。ユーザーは「育成した」「素材を使った」という事実をアプリ内で二重管理する必要があり、所持数と現実が乖離する。

現在値の変更を「育成イベント」とみなして所持数を自動で増減できれば、ユーザーは1か所の操作で「育成記録」と「在庫管理」が連動する。ただし初期セットアップ時には「過去の事実を入力しているだけ」で素材を消費すべきではないため、明示的なモード切替で挙動を分離する必要がある。

## What Changes

- `/material` ページに **「育成記録モード」トグル** を追加（既定 OFF、共通目標パネル展開時に表示、折りたたみ時はONなら `● REC` インジケータを表示）。
- モードが ON のとき、再臨ピップ／スキル・アペンドチップで `start` を変更すると、`start` の差分に対応する素材を `localStorage['posession']` から **自動増減** する。`start` が増えれば消費（減算）、減れば返還（加算）。`end`（目標値）変更と `disabled`（所持toggle）は対象外。
- 変更時に **トースト通知** を表示。サーヴァント名・ステップ（例: `再臨 1→2`）・消費/返還アイテム一覧（アイコン + 数量）を1枚にまとめる。1秒以内の同サーヴァント同 target 連続変更は同一トーストにマージ。
- 所持数が消費量に対して不足する場合、**0 にクランプ** したうえで、不足アイテムごとに「消費前の所持数」を入力できるインラインフォームをトースト内に表示。送信すると `possession[id] = max(0, 入力値 − 消費量)` で帳尻が合う。
- スキル/アペンドチップに **長押し or 右クリックで -1** の操作を追加（誤タップ時の現在値巻き戻しのため。pip も同様のジェスチャーで統一）。
- 所持数を初めて入力した直後に1回だけ表示する **モード切替おすすめバナー**（「セットアップが進んでいるようです、育成記録モードにしますか？」）。dismiss するか ON にすると再表示しない。
- モードスイッチ横に `?` ツールチップで挙動を説明。
- `localStorage['posession']` を `/material` と `/material/result` の双方から参照・更新するため、既存の `useLocalStorage` の `ls-sync` カスタムイベントを介してリアルタイム同期する。
- shadcn/ui の **Sonner（toast）コンポーネント** を追加し、`app/layout.tsx`（または `/material` レイアウト）にプロバイダを設置。

## Capabilities

### New Capabilities
（なし）

### Modified Capabilities
- `material`: 現在値変更時の素材自動増減、トラッキングモードのトグル、長押し/右クリックによる現在値の減算、不足時インライン入力、所持数の共有という新規要件群を追加する。

## Impact

- **コード**:
  - `components/material/index.tsx`: モードトグル状態、`possession` の `useLocalStorage`、差分計算ロジック、トースト発火を追加。
  - `components/material/servant-card.tsx`: `onStartChange` コールバックを受け取り、長押し/右クリックのジェスチャーを実装。
  - `lib/sum-materials.ts` の隣に **`lib/diff-materials.ts`**（仮）を新設し、`(target, prevStart, newStart)` から消費/返還の素材セットを算出する純関数を切り出す。`sumMaterials` 自体は触らず、同じ材料テーブル参照ロジックを共有する。
  - `components/ui/sonner.tsx`: shadcn の Sonner コンポーネントを追加。
  - `app/material/layout.tsx`（または `app/layout.tsx`）: `<Toaster />` を配置。
  - 必要に応じてカスタムトースト用の小さなコンポーネント（不足時インライン入力UI）を `components/material/` 配下に新設。
- **データ/永続化**:
  - 新規 localStorage キー: `material/tracking-mode`（boolean）、`material/tracking-suggest-dismissed`（boolean）。
  - 既存 `posession` キーへの書き込み元が増える（`/material` ページからも書く）。スキーマ自体は変更なし。
- **依存関係**:
  - `sonner` パッケージを追加（shadcn のセットアップ手順に従う、`pnpm` 使用）。
- **i18n**: 新規文言（モード説明、トースト見出し「消費」「返還」、不足時メッセージ、おすすめバナー文言など）。既存の翻訳キー方針に従って追加。
- **既存挙動**:
  - モード OFF が既定なので、既存ユーザーの体験は変わらない（破壊的変更なし）。
  - クラウド同期対象（`sync` spec）は `posession` 既に対象。今回の新規キー（`material/tracking-mode` 等）はクライアントのみ・端末ローカル設定として同期対象外でよい想定。
