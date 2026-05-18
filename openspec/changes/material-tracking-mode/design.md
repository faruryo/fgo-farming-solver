## Context

`/material` ページの `ChaldeaState` と `/material/result` ページの `possession`（`localStorage['posession']`）は現在、別ページでバラバラに編集されている。前者は「いま何段階目か（`start`）」「目標は何段階か（`end`）」を持ち、後者は「素材何個持っているか」を持つ。

ユーザーがゲーム内で再臨/スキル強化を実行すると、現実世界では「`start` が +1」「対応する素材が消費」が同時に起きる。アプリではこの2つを別々に手入力する必要があり、所持数が実態とすぐにズレる。

本変更は、`start` の変化を「育成イベント」と解釈して所持数を自動増減する機能を追加する。ただし新規ユーザーが初期セットアップで現在のサーヴァント状況を入力するときには **発火させてはいけない** ため、明示モード切替が必要。

### 既存の構造

- `lib/sum-materials.ts`: `range(start, end)` を回して各レベルの素材を合算。target ごとに `appendSkillMaterials | skillMaterials | ascensionMaterials` を参照。
- `hooks/use-local-storage.ts`: `ls-sync` カスタムイベント発火により、同一プロセス内の他コンポーネントでも localStorage 更新を即時反映できる。
- `components/material/servant-card.tsx`: pip クリックで `setAsc`、chip クリックで `setSkill` / `setAppend`。`prevStart` と `newStart` はクリックハンドラ内で既に把握済み。

### 制約

- 既存ユーザーの体験を壊さない（モード OFF が既定）。
- `pnpm` を使う。
- shadcn/ui の慣習に従う（`components/ui/` 配下に新規UIコンポーネント）。
- Cloudflare Workers ランタイムで動く（クライアント側機能なので大きな影響はない）。

## Goals / Non-Goals

**Goals:**

- `start` 変更時に所持数を自動で増減する仕組みを導入する。
- 初期セットアップ時に誤って素材が引かれない「モード切替」を提供する。
- 誤タップ・操作ミスからの復帰手段（長押し/右クリックで -1）を統一する。
- 所持数が不足したときも、入力導線を維持して整合性をリカバリできるようにする。
- `/material` と `/material/result` で possession 状態をリアルタイム共有する。

**Non-Goals:**

- バッチ Undo（直近 N 件の変更をまとめて取り消す）。本提案では Undo は「カードでの逆操作（-1）」に集約する。
- 整合性リマインダー（「30 日以上更新されてない」等）。将来課題。
- カード上の視覚演出（pip 光らせる等）。別 change で扱う。
- chip の popover 化（タップ → 全レベル選択）。別 change で扱う。
- QP の特別扱い。`sum['1']` として既に他素材と同等に扱われているので、同じ流儀で増減する。
- クラウド同期スキーマの拡張（モード自体は端末ローカル設定）。

## Decisions

### 決定1: 差分計算は純関数に切り出す（`lib/diff-materials.ts`）

`sumMaterials` 内のロジック（target ごとの材料テーブル選択 + `range(start, end)` 走査）を再利用するため、新規ファイル `lib/diff-materials.ts` に純関数を切り出す。

```ts
// 概念モデル（実装の詳細はtasks）
export type MaterialDelta = {
  items: { itemId: string; amount: number }[]
  direction: 'consume' | 'return'
}

export const diffMaterialsForStartChange = (
  servantMaterials: ReducedMaterialsRecord,
  target: TargetKey,
  prevStart: number,
  newStart: number
): MaterialDelta | null
```

- `prevStart < newStart` → `consume`, `range(prevStart, newStart)` で合算
- `prevStart > newStart` → `return`, `range(newStart, prevStart)` で合算
- `prevStart === newStart` → `null`
- QP も `'1'` キーとしてアイテムに含める（既存 `sumMaterials` と同じ表現）

**なぜ**: `sumMaterials` を変えると既存の Calculate 動線に影響が出る。差分計算は独立した単純な責務なので分離する。

**代替案**: `sumMaterials` を汎用化（`range(start, end)` の指定を引数化）。却下：呼び出し元複雑化で見通しが下がる。

### 決定2: possession は `useLocalStorage('posession', {})` で両ページが共有

既存の `/material/result` で使われているキー `'posession'`（既存タイポ）を `/material` 側も `useLocalStorage` で読み書きする。

- 同一キーへの書き込みは `ls-sync` カスタムイベントで両ページが互いに反映する。
- スキーマは `Record<string, number | undefined>` のまま。

**なぜ**: 既存キーを再利用すれば、既存ユーザーのデータをそのまま使える。タイポ修正は範囲外（既存の `sync` spec、KV、その他参照箇所への波及を避ける）。

### 決定3: トラッキングモードは独立の localStorage キー

新規キー `material/tracking-mode`（`boolean`）を `useLocalStorage` で管理。

- 既定 `false`。
- グローバルパネルのトグルで変更。
- 折りたたみヘッダで ON のときだけ `● REC` チップを出す。

**なぜ**: モード状態は ChaldeaState ともユーザー設定（既存の `material` キー）とも責務が違う。独立キーで疎結合に保つ。

**代替案**: `material` キーに混ぜる。却下：既存の永続スキーマと sync スキーマを変えると影響範囲が広い。

### 決定4: トーストライブラリは shadcn/ui の Sonner を採用

shadcn/ui には Sonner 統合がある。`pnpm dlx shadcn@latest add sonner` で導入し、`<Toaster />` を `app/layout.tsx` か `app/material/layout.tsx` に置く。

- 同一サーヴァント + 同一 target の連続変更は、同じ Sonner toast `id` を使って 1 秒以内なら内容を上書きマージ。
- カスタム JSX をトースト中身に渡せるので、不足時のインライン入力フォームを内包できる。

**なぜ**: shadcn を既に使っているので追加コスト最小。Sonner はアクション・カスタム JSX・id によるアップデートに対応しており、コアレッシングと「不足時にインライン入力」の両方が綺麗に書ける。

**代替案**:
- 自前トースト: 実装コスト高、アクセシビリティ要件を満たすのが大変。却下。
- shadcn `toast`（旧API）: 既に deprecated 寄り。却下。

### 決定5: 減算ジェスチャーは「長押し」と「右クリック（contextmenu）」の両対応

pip と chip 共通で:

- `pointerdown` から 500ms 経過したら `-1`（長押し）。タッチでも動作。
- `contextmenu` イベントで `-1`（PC）。`event.preventDefault()` で右クリックメニュー抑止。
- 通常クリック（タップ）は既存挙動（pip は `val` セット、chip は +1 サイクル）。

`?` ツールチップに「タップ:+1 ／ 長押し:-1」を明記。

**なぜ**: モバイルとデスクトップ両対応。既存の +1 サイクル挙動を壊さない。

**代替案**:
- chip タップで popover を出して全レベル選択: クリック数が増える、既存 UX を変える。別 change。
- shift+クリックで -1: 隠しすぎる。
- ホバーで ± ボタン表示: モバイル非対応。

### 決定6: 不足時はトースト内インライン入力

`possession[id]` が消費量に満たないとき：

1. `possession[id] = 0` にクランプ（実消費反映）。
2. トースト内に「不足: 〇〇 ×N」と「消費前の所持数: [____] [更新]」を表示。
3. ユーザーが入力 → `possession[id] = max(0, 入力値 − 消費量)`。

「消費前」と明示することで、入力値が「いま見えている所持数（既に消費反映済み）」と混同されない。

**なぜ**: ページ遷移なしでリカバリ可能。確かに既に消費は反映されたが、入力値で帳尻を合わせれば結果は正しい状態に収束する。

### 決定7: モードON推奨バナーの発火タイミング

`possession` に **初めて非 0 の値が書かれた直後** に、`material/tracking-suggest-dismissed` が `false` かつ `material/tracking-mode` が `false` なら、`/material` ページに 1 回だけバナーを表示。

- 「ON にする」を選ぶ → モードON、dismiss フラグも true。
- 「今はやめておく」を選ぶ → dismiss フラグ true。
- バナー UI は共通目標パネルの直下に静的に挿入（既存レイアウトを壊さない控えめなボックス）。

**なぜ**: possession 入力は「セットアップが進んだ」唯一明確なシグナル。calculate 回数や所持数 N体閾値は判定が曖昧。

### 決定8: モード OFF 時の挙動

モード OFF のとき、`onStartChange` は呼ばれるが **possession は触らない**（トーストも出さない）。`start` 自体の更新はモードに関わらず同様に動作する。

ジェスチャー（長押し/右クリック）はモードに関わらず動作する（誤タップ復帰は OFF 時にも有用）。

### 決定9: 「all」キー（共通目標）は対象外

`chaldeaState.all` は共通目標保持専用のメタ状態。`start` 概念があっても実在サーヴァントではないため、`onStartChange` は `id === 'all'` をスキップする（既存 `sumMaterials` と同様の扱い）。

### 決定10: トーストの内容と表示時間

- ヘッダ行: `アルトリア 再臨 1→2` または `アルトリア スキル1 4→5` 等。
- 本文: アイテムアイコン＋名前＋数量を縦に並べる。
- 不足アイテムは「⚠ 不足」マーク + インライン入力フォーム。
- ライフタイム: 通常 2.5 秒、不足あり時は 6 秒（入力時間を確保）。
- 位置: 画面下部右（モバイルは下部中央でも可。Sonner の `position` プロパティで切替）。

## Risks / Trade-offs

- **Risk**: モード ON のままセットアップ続きをすると爆損する（例: pip を高い値まで一気に上げて素材が消し飛ぶ）。  
  → Mitigation: 既定 OFF＋ON 切替時の `?` ツールチップで挙動を周知。インライン入力で復旧可能。長押し -1 で逆方向に巻き戻せばトーストも返還方向で出る。

- **Risk**: 連続クリックでトーストが大量に出る。  
  → Mitigation: 同サーヴァント + 同 target の連続変更は 1 秒のデバウンス窓内で同じ Sonner `id` を再利用し、内容（合計差分）を上書き更新する。

- **Risk**: 「消費前の所持数」入力 UX が誤解される。  
  → Mitigation: ラベル文言で「消費前」と明示。プレースホルダに「直近の消費は自動で減算」など補足。

- **Risk**: `posession` 既存タイポを残す。  
  → Mitigation: 範囲外として明示。タイポ修正は別 change を切る前提。

- **Risk**: localStorage 容量・同期ペイロード増加。  
  → Mitigation: 新規キーは boolean 2 個だけ。既存 `posession` の利用増だけで増分は無視できる。

- **Trade-off**: モード OFF 既定なので、機能の発見性が低い。  
  → Mitigation: 初回 possession 入力後の「ON 推奨バナー」で発見性を担保。`?` ツールチップ + `● REC` インジケータで使用感を補強。

- **Trade-off**: 長押し 500ms はモバイルで「タップが少しもたつく」と感じる人がいるかも。  
  → Mitigation: 通常タップ判定（300ms 未満）は即時 +1 とする。500ms 経過時点で `-1` を発火し、その後の `pointerup` で +1 は発火しない。

## Migration Plan

破壊的変更ではない（既定 OFF）。デプロイ後の影響：

1. 既存ユーザー：何も変わらない。`/material/result` の所持数編集も従来通り動作。
2. 新規/既存ユーザーが possession を初めて入力すると、`/material` 上に推奨バナーが 1 回表示される。
3. モードを ON にしたユーザーから順次新挙動を体験。

ロールバック: feature flag は導入しない。問題が出たら revert で十分。`localStorage['material/tracking-mode']` が残っても、UI が消えれば無視される（無害）。

## Open Questions

- バナーの dismiss は端末ローカルか、クラウド同期に乗せるか？ → 端末ローカル想定（細かすぎ）。実装時に再確認。
- 不足時インライン入力で「消費前の所持数」を入れたあと、別アイテムが続けて不足したらどうマージする？ → 同一トースト内に複数行で表示。実装時の細かい挙動はタスク内で詰める。
- Sonner の `position` をモバイルとデスクトップで切り替えるか？ → 初版は `bottom-right` 固定で良さそう。後日検討。
