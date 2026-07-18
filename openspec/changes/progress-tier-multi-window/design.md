# Design: progress-tier-multi-window

## Context

`lib/progress/tier.ts` の5段階tier判定(design.md 2026-07-11 `progress-5tier-lap-value` 参照)は、単一baseline(`selectBaselineRow` が「約30日前に最も近い1点」を選ぶ)と固定しきい値(legendary≥60/large≥15/medium≥5、周/日)で構成されていた。

本番実測(開発者本人、唯一の利用者):
- 前進周回2,701周 / 経過29.8日 ≈ 90.7周/日 → legendary 判定
- 実際の活動: イベント通常周回 + デイリーミッションチケットを15日分まとめて交換 + りんご + 冠位研鑽戦アーチャーの毎日ポッド消化
- 本人の体感は「そこまで頑張っていない」

この乖離は2つの原因が絡む:
1. **しきい値の較正不足**: legendary=60は「ボックス/レイド全力月」を想定した値だったが、通常運用でも超えてしまう。
2. **比較窓の粒度過小によるフェアネス問題**(しきい値とは別軸): デイリーミッションチケットは最大90日ぶん貯めて一括交換できるゲーム内仕様がある。もし比較窓がたまたま「直近30日はチケット未消化」のタイミングに当たると、実際は継続してプレイしているのに medium/small に落ちてしまう。30日固定窓はこの手のバースト性のある入手経路(チケット・期間限定ログボ一括受け取り等)に対して脆弱。

サーバ側は元々「複数期間(period)」を扱える設計だった名残がある: `SnapshotPeriod = 'previous' | 'week' | 'month'` と `ProgressResponse.periods = { previous, week, month }` が既存だが、現状は歴史的経緯で `week`/`month` が常に `null`(`fetchAllSnapshotsByPeriod` が `previous` 一点だけを返すよう縮退済み)。`lib/progress/summary.ts` の `buildPeriodSummary(period, snapshot, ctx, hasAnyPastSnapshot)` は period キーに依らない純関数で、複数period分呼び出すだけで使い回せる。`selectBaselineRow(rows, targetMs)` も targetMs を変えるだけで30/60/90日どのターゲットにも使い回せる総称関数。

利用者はアプリ開発者本人のみで、複数ユーザーのスケーラビリティ・D1容量・新規/復帰ユーザーの初期データ不足は考慮不要(単一アカウント運用)。

## Goals / Non-Goals

**Goals:**
- しきい値を実測(90.7周/日が「そこまで頑張っていない」月)に合わせて再較正する: `legendary: 100 / large: 30 / medium: 15`。
- 比較窓を30日固定から「30/60/90日それぞれに最も近いスナップショット候補」に拡張し、各候補の`perDay`(実elapsedMinutesベース)のうち最大のものを採用することで、バースト性のある入手経路が短い窓に当たらなかった場合の不当な過小評価を避ける。
- 既存の汎用設計(`buildPeriodSummary`, `selectBaselineRow`)を再利用し、DBスキーマ変更なしで実装する。

**Non-Goals:**
- 複数ユーザー運用時のD1容量・パフォーマンス最適化(単一ユーザー運用のため対象外)。
- `state_snapshots` の保持期間ポリシー・間引きジョブの追加(別changeで検討)。
- large のしきい値を「自然回復288AP/日」等のゲーム内メカニクスに再アンカーする精緻化(今回はユーザー指定の概数 100/30/15 を採用する。将来の再較正で扱う)。

## Decisions

### D1: しきい値変更(legendary/large/medium = 100/30/15)

- 60/15/5 → 100/30/15。ユーザーの実感較正による指定値。
- **BREAKING**: 元の design.md(2026-07-11)のペルソナ受け入れ基準「P1新米(自然APフル活用≈19周/日)はlarge到達可能」が成立しなくなる(19 < 30 → medium)。これは意図的な変更として受け入れる(唯一の利用者はP1新米ではないため実害なし)。`lib/progress/lap-value.persona.test.ts` の P1 期待値を `medium` に更新済み(本changeの先行作業)。
- 代替案「比率維持で25/8」「自然回復アンカーで15/8」は却下: 前者はP1問題を回避できず、後者は比較窓拡張(D2)により「不当に低く出る」問題がウィンドウ側で解決されるため medium 側を上げる必然性が薄い。ユーザー最終判断の 30/15 を採用。

### D2: 比較窓を30/60/90日の複数候補に拡張し、perDay最大を採用

```
候補 = { d30: 30日前に最も近い行, d60: 60日前に最も近い行, d90: 90日前に最も近い行 }
       (selectBaselineRow の targetMs を変えて算出。同一 snapshot id は1候補に畳む)
各候補について:
  forward = computeForwardProgress(..., pastPosession=候補.posession)
  forwardPerDay = forward.forwardLaps / (候補.elapsedMinutes / 1440)
採用候補 =
  forward.forwardLaps > 0 の候補が1つ以上あれば、その中で forwardPerDay 最大の候補
  なければ、effortPerDay(全候補の effortLaps/日)が最大の候補(labor 補完、legendaryには到達させない)
tier = classifyTier(採用候補.forwardLaps, 採用候補.elapsedMinutes)
       または forward<=0 なら classifyEffortTier(採用候補.effortLaps, 採用候補.elapsedMinutes)
```

- forward系とeffort系は指標を跨いで比較しない(design.md 2026-07-11 D3/D4の「前進と労力は別軸」を踏襲)。
- 同値タイは短い窓(d30 > d60 > d90 の優先順)を採用(表示の鮮度優先)。
- `pastPosession` が欠損する候補(degenerate snapshot)は除外(既存 `selectBaseline` の除外基準を流用)。
- 代替案「3窓の中央値/平均を使う」は却下: ユーザーの意図は「不当に低く出るのを避ける」ことで、平均化は依然としてバーストを均してしまい目的に合わない。max採用が意図と一致。

### D2b: フック公開APIの変更(二重選定の排除)

`buildPeriodSummary` はvalid snapshotなら常に`fallback: null`を返すため、新設計では d30/d60/d90 の3候補が(揃っていれば)いずれも `fallback: null` かつ `pastPosession` ありの状態でクライアントに届く。この状態で `components/farming/ProgressReportPanel.tsx:31` が現状のまま `selectBaseline(data.periods)` を再実行すると、hook (`use-progress-report.ts`) が forward/effort 計算の末に選んだ「本当の勝者」とは無関係に、出現順で別の period を拾ってしまう二重選定バグになる(Fable レビューで確認済み)。

**決定**: 「候補のうちどれを採用するか」は drops 依存の perDay 計算結果に基づく計算ロジックであり、表示コンポーネントの責務ではない。`useProgressReport` フックの戻り値を「`ProgressResponse` 全体」から「計算・選定まで完了した単一の `PeriodSummary | null`(+ 元の `ProgressResponse` は必要なら併せて)」に変更し、`ProgressReportPanel.tsx` からは `selectBaseline` の独自呼び出しを削除してフックの選定結果をそのまま使う(`ServantPraise` へのメッセージ選定も同じ選定結果を使う)。

- 代替案(b)「勝者以外を`data.periods`からnull化してから返す」: 見かけ上動くが、既存フォーマットを保ったまま中身をゴースト化する隠れ仕様になり、後続の保守で再び罠になる。却下。
- 代替案(c)「`hasComparableContent`の判定にforwardLaps算出済みかどうかを加える」: drops未取得時はforwardLapsが恒久的にundefinedのまま`finalizeBaselineSummary`が呼ばれる既存挙動(`use-progress-report.ts:129`)と衝突し、判定マーカーとして安定しない。却下。
- drops 未取得時(fallback表示のメッセージ選定含む)の挙動もフック側に寄せ、既存の「drops 無しでも fallback 付き summary は返す」動作を壊さないこと。

### D3: サーバ/型のキー名変更

- `SnapshotPeriod`: `'previous' | 'week' | 'month'` → `'d30' | 'd60' | 'd90'`(意味の通る名前に置き換え。`week`/`month`は現状未使用の縮退済みスロットのため実質破壊的変更なし)。
- `fetchAllSnapshotsByPeriod` を3ターゲット(30/60/90日)で `selectBaselineRow` を呼び出す実装に変更(重複行は id で dedup、同一 `Snapshot` オブジェクトを複数キーに割り当てて可)。
- `buildProgressResponse`(`lib/progress/summary.ts`)は `d30`/`d60`/`d90` それぞれに `buildPeriodSummary` を呼ぶだけで既存ロジックを流用できる。
- クライアント側 `select-baseline.ts` の役割を「使える1period選択」から「forward/effort perDay 最大のperiod選択」に置き換える(`hooks/use-progress-report.ts` 側で3候補それぞれに `computeForwardProgress`/`computeEffortLaps` を計算してから比較する必要があるため、選定ロジックの主体を `select-baseline.ts` からuse-progress-report.ts、または新設の `select-best-window.ts` に移す)。

## Risks / Trade-offs

- [P1新米ペルソナがlarge到達不能になる(D1)] → 唯一の利用者は新米ではないため実害なし。将来複数ユーザー化する場合は再検討が必要(Non-Goalsに明記)。
- [3候補それぞれでforward/effort計算を行うためクライアント計算量が3倍] → 単一ユーザー・月1回程度の表示更新のため無視できる規模。
- [d30/d60/d90が同一snapshotに解決するケース(蓄積データが少ない期間)] → dedupしても実害はないが、実装時に「3候補全て同じ結果」になることをテストで確認する。
- [しきい値100/30/15はユーザー1名の実感による指定値で、ゲーム内メカニクスへの厳密なアンカーが無い] → 許容(Non-Goals)。将来「自然回復ベースの再アンカー」を別changeで検討可能なようdesign.mdに記録する。

## Migration Plan

クライアント計算ロジック・サーバのperiod分解ロジックの変更のみで、DBスキーマ変更・データ移行は不要。`SnapshotPeriod`のキー名変更は型定義のみでAPIレスポンス形状の破壊的変更を伴うが、フロント/バックエンドを同時にデプロイするため実害なし(外部API利用者はいない)。ロールバックはコード revert のみ。

## Open Questions

- large=30のアンカーをどう表現するか(design.mdのコメントで「自然回復を使い切る量」という説明が今回のD1変更で意味を持たなくなるため、コメント更新が必要)。
