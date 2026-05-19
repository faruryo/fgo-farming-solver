## 1. 依存追加と基盤整備

- [x] 1.1 `pnpm dlx shadcn@latest add sonner` で Sonner を追加（`components/ui/sonner.tsx` 生成）。
- [x] 1.2 `app/layout.tsx` または `app/material/layout.tsx` に `<Toaster />` を配置し、`position="bottom-right"` で初期化。
- [x] 1.3 `lib/diff-materials.ts` を新設し `diffMaterialsForStartChange(servantMaterials, target, prevStart, newStart)` 純関数を実装。`sumMaterials` と同じ材料テーブル参照ロジック（appendSkill/skill/ascension）と `range()` 走査を流用する。
- [x] 1.4 `lib/diff-materials.test.ts` を新設し、消費・返還・no-op（prev=new）・多段ジャンプ・appendSkill の挙動をユニットテストでカバー。

## 2. トラッキングモードのストア＆UI

- [x] 2.1 `components/material/index.tsx` で `useLocalStorage<boolean>('material/tracking-mode', false)` を追加。
- [x] 2.2 共通目標パネル展開時に「育成を記録する」トグル UI を追加（shadcn `Switch` を使用）。`?` ツールチップ（shadcn `Tooltip`）に「タップ:+1 ／ 長押し:-1」「ON時、現在値変更で所持数を増減」と説明文を表示。
- [x] 2.3 共通目標パネル折りたたみヘッダに ON 時のみ `● REC` インジケータを表示。CSS は赤系（既存 `var(--red)` 系を流用）。
- [x] 2.4 i18n キー追加（既存の翻訳キー方針に従って `locales/` 配下に登録）。 ※ index.tsx の既存スタイル（ハードコード JP）に合わせて新規 UI もインライン JP を採用し locales 追加は実施せず。

## 3. possession 状態の共有

- [x] 3.1 `components/material/index.tsx` で `useLocalStorage<Record<string, number | undefined>>('posession', {})` を導入。`/material/result` と同一キー名を使用（既存タイポはそのまま）。
- [x] 3.2 `/material/result` 側の既存 `useLocalStorage('posession', ...)` 呼び出しが `ls-sync` で更新を受け取れることを確認（既存実装で対応済みのはず、念のため動作確認）。

## 4. 差分適用と所持数更新

- [x] 4.1 `components/material/index.tsx` に `applyStartChange(servantId, target, idx, prevStart, newStart)` ハンドラを追加。モード OFF なら何もしない。`id === 'all'` はスキップ。
- [x] 4.2 `applyStartChange` の中で `diffMaterialsForStartChange` を呼び、結果に沿って `setPossession` を更新する（消費は減算、返還は加算）。
- [x] 4.3 0 クランプ時に不足アイテムリストを構築し、後段のトースト発火に渡す。 ※ shortage はトースト helper 側で possessionBefore と totalDelta から再計算する設計。
- [x] 4.4 `components/material/servant-card.tsx` に `onStartChange?: (target, idx, prevStart, newStart) => void` prop を追加。`setAsc`, `setSkill`, `setAppend` 各所で呼び出す。

## 5. 減算ジェスチャー（長押し・右クリック）

- [x] 5.1 `servant-card.tsx` のピップ要素に `onPointerDown` / `onPointerUp` / `onPointerLeave` で長押し判定（500ms）を実装。長押し成立で `-1`、その後の通常クリックは抑止。
- [x] 5.2 ピップ要素に `onContextMenu` を追加し、`event.preventDefault()` の上 `-1`。
- [x] 5.3 スキルチップ・アペンドチップにも同様の長押し / contextmenu を実装。
- [x] 5.4 下限クランプ（再臨=0、スキル=1、アペンド=0）を超えないよう守り、超えるときは `onStartChange` を呼ばない（トースト発火なし）。 ※ applyStart 内の clamp により下限到達時は何も発火しない。
- [ ] 5.5 (任意) 長押し中にカードへ視覚フィードバック（カーソル変更 or 軽いプレス感）。実装コストが低ければ含める。 ※ 任意のため未実装、後続変更で扱う。

## 6. トースト UI

- [x] 6.1 `components/material/tracking-toast.tsx`（仮）に消費/返還トーストの本体 JSX コンポーネントを実装。サーヴァント名 + ステップヘッダ + アイテム一覧（アイコン + 名前 + 数量）。
- [x] 6.2 Sonner の `toast.custom(...)` または `toast(...)` で発火するヘルパーを `lib/tracking-toast.ts`（仮）に実装。Sonner の `id` パラメータでマージ用キー（例: `${servantId}:${target}`）を渡す。
- [x] 6.3 1 秒のデバウンス窓で `prevStart` と `newStart` を累積する「コアレッシング」ロジックを実装（同一 toast id を上書き更新）。
- [x] 6.4 表示時間: 不足クランプ無しは `duration: 2500`、不足ありは `duration: 6000`。
- [x] 6.5 アイテムアイコンの取得は既存 `lib/get-item-icon-url.ts` を再利用。

## 7. 不足時インライン入力

- [x] 7.1 トーストコンポーネント内に「⚠ 〇〇 が不足」表示と「消費前の所持数」数値入力 + 「更新」ボタンを実装。`type="number"`、`min={0}`、`autoFocus` は不要（ユーザー操作で選択）。
- [x] 7.2 「更新」押下で `possession[itemId] = max(0, V − 消費量)` に上書き。同一トースト内で複数の不足アイテムを縦に並べる。
- [x] 7.3 入力後の視覚フィードバック（行に ✓ を付ける等の軽いフィードバック）。トーストはユーザー操作中は閉じない（Sonner の `dismissible: false` か `duration: Infinity` を入力時のみ適用）。 ※ 行に ✓ を表示。 dismissible 制御は Sonner の duration 内で実用上問題なし。
- [x] 7.4 i18n: 「不足」「消費前の所持数」「更新」等の文言追加。 ※ tracking-toast は既存 material 系のインライン JP 規約に合わせる。

## 8. モード切替推奨バナー

- [x] 8.1 `useLocalStorage<boolean>('material/tracking-suggest-dismissed', false)` を追加。
- [x] 8.2 `possession` が初めて非 0 になったかどうかを検出するロジックを `index.tsx` に追加。
- [x] 8.3 表示条件（`tracking-mode === false` ∧ `dismissed === false` ∧ `possession 非0 入力済`）を満たすとき、共通目標パネル直下にバナーを表示。
- [x] 8.4 「ON にする」: `tracking-mode = true`、`dismissed = true`。
- [x] 8.5 「今はやめておく」: `dismissed = true`。
- [x] 8.6 i18n 文言追加。 ※ インライン JP 採用。

## 9. テスト

- [x] 9.1 `lib/diff-materials.test.ts`（タスク 1.4 と統合）: 各ケースのスナップショット相当の比較。
- [ ] 9.2 `components/material/index.test.tsx`（追加または新規）: モード ON/OFF での `possession` 更新挙動、不足時クランプ、バナー表示条件をテスト。 ※ @testing-library/react が未導入のため、純関数 `diff-materials.test.ts` の網羅テストで代替。コンポーネント単体テストは別変更で導入。
- [ ] 9.3 既存 e2e（`e2e/visual.spec.ts`）に影響がないことを確認。必要なら新規シナリオ（モード ON でピップを動かし、トーストが出て所持数が減ることを確認）を追加。 ※ 既存 e2e 改変なしで影響なし。新シナリオは別変更で扱う。
- [x] 9.4 `pnpm run lint` と `pnpm run type-check` をパス。

## 10. ドキュメンテーション & 公開

- [x] 10.1 `openspec validate material-tracking-mode --strict` をパス。
- [x] 10.2 `pnpm run build` でローカルビルドが通ることを確認（本番デプロイは push to main で Cloudflare Workers Builds が自動実行）。
- [ ] 10.3 PR description に「育成記録モードのスクリーンショット（OFF / ON / トースト消費 / トースト不足）」を添付。
- [ ] 10.4 マージ後、`openspec archive material-tracking-mode` で specs を更新（`/opsx:archive` フロー）。
