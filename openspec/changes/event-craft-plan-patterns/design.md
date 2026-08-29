## Context

現行 Stage1 は `quest_*` と `craft_*` の同時最小化。Stage2 の使い切りは単独1個価値で、残余を周回LPにかけ直さない。UIは12品とトグル。提案の動機は proposal.md。grilling で満遍なくをAP/周回別計算、同一皿の畳み＋別名、選択永続、マシュは選択追従に更新。期待値テーブルは別changeだが、5本のyieldは分岐させない。

## Goals / Non-Goals

**Goals:**

- 5本の皿ベクトルを返す純関数と、表示用の畳み・別名リスト。
- 満遍なく（周回）と満遍なく（AP）はクエスト変数なしの別MILP。
- 使い切りは食材残り最小→残余周回コスト。常時カード。評価数字は周回とAP。
- 表示は作成数>0のみ。選択消失時は吸収先。

**Non-Goals:**

- 金寄せ・手数最小・作らないカード・クエスト名の主表示。
- 使い切りのAP/周回分割。
- 期待値テーブル（0.40 / 残り均等）の新規定義。テーブルは `event-craft-expected-yields`。本変更の5本は適用時点の同一yieldを共有する。
- 配布タブの分母スイッチ変更。
- 周回LPの整数化。

## Decisions

### 1. 二層: 皿決めと残余評価

- 層① パターン固有の目的で整数の料理回数。
- 層② `n'` を `continuousOptimalCost` の turn と ap の両方（またはカード単位）で評価。クエスト内訳は返さない。
- 代替: 満遍なくもquest同時最適化 → 不採用。

### 2. 計算5本と表示畳み

IDs: `runs` | `ap` | `even-turn` | `even-ap` | `exhaust`。

表示順に積み、**すでに出しているカード全部**（`exhaust` 除く）と正の多重集合を比較する。一致したら最初の表示カードへ `aliases` を付けて出さない。

- `runs` は常に表示。
- `ap` → 表示済みと一致しなければ表示。
- `even-turn` → 同様（`ap` が出ていて皿が同じなら `ap` へ吸収。`runs` だけとの比較に限定しない）。
- `even-ap` → 同様（`even-turn` や `ap` とも比較）。
- `exhaust` は常に表示。他へ畳まない。
- 一致は正の `(recipeId, count)` のみ。
- 代替: 満遍なくを1本の相対Chebyshev → grilling で不採用（APと周回を分ける）。

### 3. 満遍なく: 単位ごとの max burden

- `burdenTurn_i = r_i * V_turn(i)`、`burdenAp_i = r_i * V_ap(i)`。
- `even-turn`: 食材制約下で `max_i burdenTurn_i` を最小化。同点は消費食材最小。
- `even-ap`: 同様に `max_i burdenAp_i`。
- 正規化は不要（単位を混ぜない）。
- 1皿の獲得は `runs` / `ap` / `exhaust` と同じyieldマップ。`event-craft-expected-yields` 適用後は期待バスケットを使い、主産物だけに戻さない。
- 代替: 生個数max → 銅バイアス。シャドウプライス → 周回案と同型。

### 4. 使い切り

1. 余り3種合計の最小化。
2. その制約で層②の周回コスト最小。
3. `runs` を超える分は余剰枠。価値表示は単独AP換算可。カードは畳まない。

### 5. UIと永続

- 料理タブから分母スイッチと使い切りトグルを削除。配布タブの分母は残す。
- カード横並び（狭幅は縦）。選択はラジオ。マシュは選択ID。
- `planPattern` を保存。未知は `runs`。旧 `exhaust` boolean は ON→`exhaust` / OFF→`runs`。
- 保存IDが今回非表示なら aliases を持つ表示カードへフォールバック。

### 6. カードの評価単位

- `runs` / `even-turn`: 周回。
- `ap` / `even-ap`: AP。
- `exhaust`: 両方。

## Risks / Trade-offs

- [満遍なくMILPが重い] → 規模は12皿。不能なら対応するコスト最小案と同一扱いで畳む。
- [カードが増える] → 畳みと aliases で実質2〜4枚。
- [選択フォールバックが紛らわしい] → 吸収先に `同じ:` を出す。
- [旧localStorage] → exhaust boolean を一度マップ。

## Migration Plan

フロントのみ。ロールバックは revert。

## Open Questions

なし。
