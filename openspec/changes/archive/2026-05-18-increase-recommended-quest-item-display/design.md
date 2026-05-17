## Context

`RecommendedQuest.tsx` はダッシュボードの「周回予定クエスト」セクションを担うコンポーネント。1クエストあたりのドロップアイテムアイコンを `topItems` として最大3個準備し、PC表示（sm+）で表示している。変更対象は同ファイル内の useMemo と JSX のみ。

## Goals / Non-Goals

**Goals:**
- PC（sm ブレークポイント以上）でのアイテムアイコン表示を最大 5個 に増やす
- モバイルは 1個 のまま維持する
- データ取得・API 呼び出しには一切変更を加えない

**Non-Goals:**
- NearGoalSection や他セクションへの波及的変更
- sm ブレークポイントの変更
- アイコンサイズ変更

## Decisions

### `.slice(0, 3)` → `.slice(0, 5)` で統一
`useMemo` 内で `topItems` を組み立てる箇所が recentResult ブランチ・fallback ブランチの2か所ある。どちらも同じ `slice` 上限を変更する。別々の値にする必要がないため統一。

### `hidden sm:flex` パターンを継続
既存コードの `topItems[0]` を常時表示、それ以降を `hidden sm:flex` で PC のみ表示するパターンをそのまま踏襲する。新たなブレークポイントや CSS クラスを追加しない。

### アイコンサイズを 26px → 22px に縮小
2行レイアウトにすると NearGoalSection のカードと高さが変わり、並列グリッドで見たときの視覚的一貫性が損なわれる。1行を維持しつつ5個を収めるためにアイコンサイズを 22px に縮小する。5個 × 22px + 4 gap × 4px = 126px となり、クエスト名への圧迫も最小限に抑えられる。

## Risks / Trade-offs

- データに5個のアイテムがない場合: `topItems` の配列長が3以下になるだけで表示は問題なし（Array.prototype.slice は範囲外を無視する）
- アイコンが 26px → 22px になるため若干小さくなるが、視認性は許容範囲内
