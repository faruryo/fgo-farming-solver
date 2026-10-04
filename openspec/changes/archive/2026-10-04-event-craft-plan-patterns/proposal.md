## Why

#61 で入れた目的別パターン選択を、本番フリーズのため #62 で切り戻した。#64/#65 で皿決めMILPの規模とゼロ削減の再割当は直ったので、同じUIをそのソルバの上に載せ直す。トグル操作が皿選びより前面に出る問題は残っている。

## What Changes

- 結果を最適化パターンのカード列として提示する。ユーザーは1つ選び、マシュはその選択に追従する。
- 計算は最大5本: **周回を減らす**、**APを減らす**、**満遍なく（周回）**、**満遍なく（AP）**、**食材を使い切る**。
- 正の皿多重集合が、すでに出している他カード（使い切り以外）と一致した満遍なく／AP案は表示しない。吸収名は残ったカードに `同じ:` で出す。使い切りは皿が同じでも常時出す。
- 5本とも同一の料理yieldを使う。`Event Craft Optimization` と `Exhaust Ingredients Option` の MODIFIED は `event-craft-expected-yields` の期待値シナリオを含む最終形とする。テーブルデータ導入はそちら。アーカイブはこのchangeを後にする。
- 各パターンの一覧から作成数0の料理を出さない。
- 満遍なくの周回山とAP山は別最適化。クエスト内訳には寄せない。
- 使い切りは食材残り最小のあと残余周回コスト最小。カードには周回とAPを参考表示。
- どのパターンも皿決定後の残り不足は周回/APのLPで評価する。クエスト内訳は主表示にしない。
- 料理タブのAP/周回スイッチと使い切りトグルをパターン選択に置き換える（**BREAKING**: 旧 exhaust はパターンIDへ移行）。選択と食材は永続。未保存なら周回。選択中が畳まれたら吸収先を選ぶ。
- 期待値テーブルファイルの追加は `event-craft-expected-yields`。本changeの対象要件はそちらと食い違わない最終形に揃える。

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `material-selection-advisor`: 単一配分＋トグルから複数パターン選択へ。満遍なくはAP/周回別計算。同一皿の畳みと別名表示。推奨0非表示。選択永続と吸収先フォールバック。

## Impact

- `lib/event-craft-advisor.ts`、`components/material/event-craft-advisor.tsx`、親タブUI、locales、テスト、localStorage
