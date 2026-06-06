## Context

進捗パネルの比較基準選定（`selectBaseline`）と、サーバの期間サマリ生成（`buildPeriodSummary`）が、「スナップショットが non-null か」だけで「比較可能か」を判定していた。旧 `/api/solve` が書いた `{items,quests}` のみの 1.4KB 残骸スナップショットは non-null だが `material`・`posession` を持たず、どの進捗指標も算出できない。これが `week` スロットに居座ると baseline に選ばれ、`previous` のフルデータが無視される。

## Goals / Non-Goals

### Goals
- `material` も `posession` も持たない degenerate スナップショットを比較基準から除外する。
- サーバ（根治）とクライアント（多層防御）の両方で除外し、片方の判定漏れに耐える。
- 既存の本番レガシー残骸を後始末する。

### Non-Goals
- 書き込み側の修正（`/api/solve` は既に material-less を書かない）。
- 進捗指標（reducedAp / growthTotal / 新規サーヴァント）の算出ロジック変更。
- スナップショット保存スキーマ・期間バケット定義（previous/week/month）の変更。

## Decisions

### degenerate の判定基準: material も posession も「両方」無い
- 採用: `!hasMaterial && !hasPosession` を degenerate とする。
- 理由: `material` だけ持つスナップショットは育成成長（growthTotal・新規サーヴァント）を算出でき、比較基準として価値がある。`posession` 欠落時の reducedAp 非表示は既存仕様（「過去所持が欠損している場合のフォールバック」）で吸収済み。両方欠落して初めて「一切比較できない」状態になる。
- 判定はスナップショットの parsed payload に対して行う。`extractChaldeaState`（material）と `extractPosession`（posession）の結果がともに `null`/空なら degenerate。

### サーバ: buildPeriodSummary で fallback を返す（根治）
- `snapshot != null` でも degenerate なら、`snapshot == null` と同じ扱いで `fallback: 'no_snapshot_for_period'`（過去スナップショットが他にあるため `first_time` ではなく）を返す。
- これにより `selectBaseline` は当該期間を fallback ありとみなし採用しない。新規残骸が将来混入しても自動で弾かれる。

### クライアント: selectBaseline の採用条件強化（多層防御）
- 現状: `ordered.find((p) => !p.fallback) ?? ordered[0] ?? null`。
- 変更: 「`!p.fallback` かつ 比較に使える中身がある（`p.pastPosession` を持つ、または `growthTotal`/サーヴァント成長を生む `material` 由来データを持つ）」期間を優先採用する。サーバ判定（#1）が効いていれば degenerate は既に fallback 付きなので二重防御となる。
- フォールバック表示用に最後の `ordered[0]` 経路は維持（全期間 fallback のときのメッセージ選択に必要）。

### 既存データ削除はマージ後（後始末）
- コード修正が本番反映されれば残骸は自動で無視されるため、削除はブロッカーではない。
- マージ・デプロイ後に `wrangler d1 execute fgo-farming-solver-db --remote` で 4 行を DELETE し、ノイズを除去する。

## Risks / Trade-offs

- **二重判定の重複**: #1（サーバ）と #2（クライアント）は機能的に一部重複するが、意図的な多層防御。`/api/progress` のモック経路や将来の経路差異に対する保険になる。
- **degenerate しか無いユーザー**: 全期間が fallback になり `no_snapshot_for_period` 系メッセージとなる。これは「実際に比較できるデータが無い」正しい状態であり、誤った満額メッセージより適切。

## Migration Plan

1. コード修正（#1, #2）＋テストを実装しマージ → 自動デプロイ。
2. デプロイ確認後、本番 D1 の残骸 4 行を DELETE。
3. ダッシュボードで baseline が `previous`（06-06 フルデータ）に切り替わり、reducedAp/育成総量が表示されることを確認。

## Open Questions
- なし（判定基準・削除タイミングはユーザー確認済み）。
