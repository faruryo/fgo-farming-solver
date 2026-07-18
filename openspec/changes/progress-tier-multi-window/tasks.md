## 1. しきい値変更(先行実施済み・検証のみ)

- [x] 1.1 `lib/progress/tier.ts` の `LAP_TIER_THRESHOLDS` を `legendary: 100 / large: 30 / medium: 15` に変更する。
- [x] 1.2 `lib/progress/tier.test.ts` のしきい値境界テストを新値に合わせて更新する。
- [x] 1.3 `lib/progress/lap-value.persona.test.ts` の P1 ペルソナ期待値を `large` → `medium` に更新する(design.md D1 のBREAKING変更を反映)。
- [x] 1.4 `lib/progress/finalize-baseline.test.ts` のしきい値依存の期待値を更新する。

## 2. サーバ側: 複数baseline候補の取得

- [ ] 2.1 `lib/progress/snapshot.ts` の `SnapshotPeriod` を `'d30' | 'd60' | 'd90'` に変更する。
- [ ] 2.2 `selectBaselineRow` を複数ターゲット(30/60/90日)向けに呼び出せるようにし、`fetchAllSnapshotsByPeriod` が3ターゲットそれぞれの最近傍行を返すよう変更する(同一 snapshot id への重複解決はそのまま複数キーに割り当ててよい。dedup はクライアント側の計算コスト削減のためのみに行う)。
- [ ] 2.3 `lib/progress/snapshot.test.ts`(未存在なら新規)で `fetchAllSnapshotsByPeriod`/`selectBaselineRow` の複数ターゲット選定を検証する: 全候補が同一行に解決するケース、30/60/90 それぞれ異なる行に解決するケース。

## 3. サーバ側: PeriodSummary生成の3窓対応

- [ ] 3.1 `lib/progress/summary.ts` の `buildProgressResponse` を `d30`/`d60`/`d90` それぞれに `buildPeriodSummary` を呼ぶよう変更する(関数自体は period キーに依らない既存実装を流用)。
- [ ] 3.2 `lib/progress/types.ts` の `ProgressResponse.periods` を `{ d30, d60, d90 }` に変更する。
- [ ] 3.3 `app/api/progress/dev-mock.ts`(開発用モック)を新しい `periods` 形状に合わせて更新する。
- [ ] 3.4 `lib/progress/summary.test.ts` があれば新形状に更新、無ければ3窓分の `PeriodSummary` が返ることを検証するテストを追加する。

## 4. クライアント側: perDay最大窓の選定

- [ ] 4.1 `lib/progress/select-baseline.ts` を「forward/effort perDay 最大の period を選ぶ」ロジックに置き換える(既存の「使える最古1件」ロジックは廃止)。関数シグネチャは `periods` に加えて各候補の forwardLaps/effortLaps 計算結果を受け取る形に変更する。
- [ ] 4.2 `hooks/use-progress-report.ts` を、3候補(d30/d60/d90、重複解決分はdedup)それぞれについて `computeForwardProgress`/`computeEffortLaps` を計算し、design.md D2 のアルゴリズム(forward>0の候補があればforwardPerDay最大、無ければeffortPerDay最大、タイは短い窓優先)で採用候補を選んでから `finalizeBaselineSummary` を呼ぶよう変更する。**あわせてフックの公開API(`UseProgressReport`)を「選定・確定済みの単一 `PeriodSummary | null`」を返す形に変更する**(design.md D2b)。drops未取得時に fallback 付き summary を返す既存挙動は維持すること。
- [ ] 4.3 `lib/progress/select-baseline.test.ts` を新ロジックに合わせて全面更新する(design.md 2026-07-18 の受け入れシナリオ相当: 30日窓バースト採用/長い窓採用/全窓ゼロでeffort補完/degenerate除外/同値タイ短い窓優先)。
- [ ] 4.4 `hooks/use-progress-report.test.ts`(未存在なら新規)で、新しい戻り値の形(選定済み単一summary)と drops未取得時のフォールバック挙動を検証する。

## 5. 表示・仕上げ

- [ ] 5.1 `components/farming/ProgressReportPanel.tsx:31` の独自 `selectBaseline(data?.periods)` 呼び出しを削除し、`useProgressReport`(4.2で変更後)が返す選定済み summary をそのまま `ServantPraise`/`ProgressReportContent` に渡すよう変更する(二重選定バグの排除。design.md D2b)。
- [ ] 5.2 `lib/progress/tier.ts` のコメント(「アンカー: 15周/日 ≈ 自然回復288AP/日」等、古いしきい値根拠の説明)を新しきい値の位置付けに合わせて更新する。
- [ ] 5.3 `openspec/specs/progress-visualizer/spec.md` に本change の delta を同期する(`openspec-sync-specs` または archive 時の自動同期)。
- [ ] 5.4 `pnpm test`(または該当スコープ)を実行し、`lib/progress/` 配下のテストが全てグリーンであることを確認する。
- [ ] 5.5 開発モック(`NODE_ENV=development`)で `/api/progress` を叩き、d30/d60/d90 それぞれ異なる snapshot が用意された状態でパネル表示を目視確認する。
