## Why

本番で `legendary` 判定が出たが、開発者本人(唯一の利用者)の体感では「そこまで頑張っていない」月だった。実測は前進周回2,701周/29.8日≈90.7周/日で、design.md の想定較正(60周/日=ボックス/レイド全力月)を軽く超えてしまう。加えて、比較窓が「約30日前に最も近い1点」に固定されているため、FGO のデイリーミッションチケット(最大90日ぶん貯めて一括交換できる仕様)を消化しないまま30日が経過すると、実際は継続してプレイしていても不当に低い tier が出てしまう懸念がある。しきい値と比較窓の両方を、実際のプレイ実感に合わせて調整する。

## What Changes

- `LAP_TIER_THRESHOLDS`(`lib/progress/tier.ts`)を `legendary: 60→100` / `large: 15→30` / `medium: 5→15` に変更する。**BREAKING**(P1 新米ペルソナの到達 tier が `large` から `medium` に変わる。design.md のペルソナ受け入れ基準を意図的に変更する)。
- 比較窓(baseline snapshot 選定)を「約30日前に最も近い1点」固定から、「30日/60日/90日それぞれに最も近いスナップショット候補(重複は1つに畳む)」に拡張する。
- 拡張した各候補について前進周回(forwardLaps)を算出し、`perDay`(周/日)が最大の候補を採用して tier・表示値を確定する(forward が算出できる候補が無ければ労力周回(effortLaps)側で同様に最大の候補を採用)。
- forward 系と effort 系は指標を跨いで比較しない(forward>0 の候補が1つでもあればその中だけで最大を取り、全候補 forward<=0 のときのみ effort 側で最大を取る)。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
- `progress-visualizer`: tier しきい値の数値変更、および比較基準を単一baselineから「30/60/90日候補のうちperDay最大を採用」する複数候補選定へ変更する。

## Impact

- `lib/progress/tier.ts`(しきい値定数)
- `lib/progress/snapshot.ts`(`selectBaselineRow` を複数ターゲット日数向けに拡張)
- `lib/progress/summary.ts` / `app/api/progress/route.ts`(サーバが返す baseline 候補を1件から複数件へ)
- `lib/progress/select-baseline.ts` / `hooks/use-progress-report.ts`(クライアント側の候補選定を「最古1件」から「forward/effort perDay 最大」へ変更)
- `lib/progress/types.ts`(`SnapshotPeriod` のキー名見直し。`week`/`month` は既に未使用のため、30/60/90日候補を表す名前へ置き換える)
- 既存テスト: `lib/progress/tier.test.ts`, `lib/progress/lap-value.persona.test.ts`, `lib/progress/finalize-baseline.test.ts`(しきい値変更に伴う期待値更新は本changeで先行実施済み)
- `openspec/specs/progress-visualizer/spec.md`(しきい値・比較窓のSHALL記述更新)
