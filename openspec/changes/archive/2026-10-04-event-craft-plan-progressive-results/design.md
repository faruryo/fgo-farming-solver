## Context

現行は `computeEventCraftPlan` が 5 本を同期で組み立て、`event-craft-allocation.worker` が完了時に 1 回 `postMessage` する。UI は 10 秒ハードタイムアウトで `EMPTY_PLAN_RESULT` を確定し、画面全体をタイムアウト文言にする。共有の solver context 構築のあとに `runs` → `ap` → `even-turn` → `even-ap` → `exhaust` の順で重い。

## Goals / Non-Goals

**Goals:**

- 同一 Worker 内でパターン完了ごとに通知し、UI が部分適用する。
- ハードタイムアウト後も受信済み結果を保持する。
- `foldEventCraftPatterns` は届いた集合に対して都度適用する。

**Non-Goals:**

- パターンごとの独立 Worker / 並列 MILP。
- 使い切り定式化の見直し。
- カードレイアウトの刷新。
- 10 秒上限そのものの撤廃。

## Decisions

### 1. 逐次ソルブ + 完了イベント

`computeEventCraftPlan` は最終 `EventCraftPlanResult` を返す既存 API を残す。内部で共有 context を一度作り、パターンを固定順に組み立て、各本のあと callback / iterator で通知する。Worker は `{ type: 'pattern', pattern }` を都度送り、最後に `{ type: 'done' }`。代替: 5 Worker 並列 → 転送コストと LP メモリが重いので不採用。

### 2. タイムアウトは terminate しても受信分は捨てない

UI はメッセージごとに fold した plan を state に積む。10 秒または `onerror` で Worker を止め、その時点の受信分を確定する。未受信 ID を `timedOutPatternIds` として持つ。全体 `didPlanTimeout` は「1件も届かず時間切れ」のときだけマシュ全体エラーに使う。代替: パターン別タイマー → 単一スレッドでは後ろの本が前の完了を待たねばならず意味が薄い。

### 3. 畳みは部分集合で再計算

途中では `ap` が未着のまま `even-turn` が出ることがある。届いた配列だけ `foldEventCraftPatterns` する。後から届いた本で吸収関係が変わったらカード集合を更新する。選択 ID は既存 `resolveVisiblePatternId`。

### 4. 入力 debounce は現状維持

食材入力の 3 秒待ち中は Worker を走らせない。段階表示は Worker 開始後だけ。

### 5. テストは pure な reducer を先に切る

Worker 購読の I/O と、メッセージ列 → plan / timeout IDs の reducer を分ける。ケース表で「runs だけ届いて timeout」「done まで全部」「0件 timeout」を固定する。

## Risks / Trade-offs

- [exhaust が最後なので 10 秒ほぼ使い切る] → 先行 4 本は出せる。アルゴリズム改修は別 issue。
- [途中 fold でカードが増減する] → 選択は吸収先へフォールバック済み。
- [古い Worker メッセージが遅延到着] → 既存どおり terminate と requestKey で無視。

## Migration Plan

フロントのみ。デプロイ後の初回計算から段階表示。ロールバックは Worker を一括 `postMessage` に戻す。

## Open Questions

なし。issue #69 の方針（パターン完了ごとの postMessage）で進める。
