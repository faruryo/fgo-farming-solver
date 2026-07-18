## 1. しきい値変更(先行実施済み・検証のみ)

- [x] 1.1 `lib/progress/tier.ts` の `LAP_TIER_THRESHOLDS` を `legendary: 100 / large: 30 / medium: 15` に変更する。
- [x] 1.2 `lib/progress/tier.test.ts` のしきい値境界テストを新値に合わせて更新する。
- [x] 1.3 `lib/progress/lap-value.persona.test.ts` の P1 ペルソナ期待値を `large` → `medium` に更新する(design.md D1 のBREAKING変更を反映)。
- [x] 1.4 `lib/progress/finalize-baseline.test.ts` のしきい値依存の期待値を更新する。

## 2. サーバ側: 複数baseline候補の取得

- [x] 2.1 `lib/progress/snapshot.ts` の `SnapshotPeriod` を `'d30' | 'd60' | 'd90'` に変更する。
- [x] 2.2 `selectBaselineRow` を複数ターゲット(30/60/90日)向けに呼び出せるようにし、`fetchAllSnapshotsByPeriod` が3ターゲットそれぞれの最近傍行を返すよう変更する(同一 snapshot id への重複解決は snapshot id 単位でメモ化し、JSON.parse を1回だけ実行して使い回す)。
- [x] 2.3 `lib/progress/snapshot.test.ts` で `fetchAllSnapshotsByPeriod`/`selectBaselineRow` の複数ターゲット選定を検証する: 全候補が同一行に解決するケース(同一オブジェクト参照になることも検証)、30/60/90 それぞれ異なる行に解決するケース。

## 3. サーバ側: PeriodSummary生成の3窓対応

- [x] 3.1 `lib/progress/summary.ts` の `buildProgressResponse` を `d30`/`d60`/`d90` それぞれに `buildPeriodSummary` を呼ぶよう変更する(関数自体は period キーに依らない既存実装を流用)。同一 snapshot id への重複解決は snapshot id 単位でメモ化し、新規サーヴァント検出・育成成長計算等を1回だけ実行して使い回す(period フィールドのみ差し替え)。
- [x] 3.2 `lib/progress/types.ts` の `ProgressResponse.periods` を `{ d30, d60, d90 }` に変更する。
- [x] 3.3 `app/api/progress/dev-mock.ts`(開発用モック)を新しい `periods` 形状に合わせて更新する。
- [x] 3.4 `lib/progress/summary.test.ts` を新形状に更新し、3窓分の `PeriodSummary` が返ることと、同一snapshotへの重複解決時に比較計算(`detectNewServants`)が1回だけ実行されることを検証するテストを追加する。

## 4. クライアント側: perDay最大窓の選定

- [x] 4.1 `lib/progress/select-baseline.ts` を「forward/effort perDay 最大の period を選ぶ」ロジック(`selectBestWindow`)に置き換える(既存の「使える最古1件」ロジックは廃止)。関数シグネチャは `periods` に加えて各候補の forwardLaps/effortLaps 計算結果を受け取る形に変更する。
- [x] 4.2 `hooks/use-progress-report.ts` を、3候補(d30/d60/d90)それぞれについて `computeForwardProgress`/`computeEffortLaps` を計算し、design.md D2 のアルゴリズム(forward>0の候補があればforwardPerDay最大、無ければeffortPerDay最大、タイは短い窓優先)で採用候補を選んでから `finalizeBaselineSummary` を呼ぶよう変更する。**あわせてフックの公開API(`UseProgressReport`)を「選定・確定済みの単一 `PeriodSummary | null`」を返す形に変更する**(design.md D2b)。drops未取得時に fallback 付き summary を返す既存挙動は維持すること。単価表(`resolveUnitPrices`)は`pastPosession`に依存しないため、3窓ぶんをまとめて算出する前に1回だけ解決して使い回す(`computeForwardProgress`/`computeEffortLaps` に任意の `unitPrices` 引数を追加)。
- [x] 4.3 `lib/progress/select-baseline.test.ts` を新ロジックに合わせて全面更新する(design.md 2026-07-18 の受け入れシナリオ相当: 30日窓バースト採用/長い窓採用/全窓ゼロでeffort補完/degenerate除外/同値タイ短い窓優先)。
- [x] 4.4 `hooks/use-progress-report.test.ts`(新規)で、新しい戻り値の形(選定済み単一summary)と drops未取得時のフォールバック挙動を検証する。
- [x] 4.5 `lib/progress/lap-value.test.ts` に、`unitPrices` を事前に渡した場合は内部で再計算せず渡した単価表をそのまま使うことを検証するテストを追加する(`computeForwardProgress`/`computeEffortLaps` 双方)。

## 5. 表示・仕上げ

- [x] 5.1 `components/farming/ProgressReportPanel.tsx` の独自 `selectBaseline(data?.periods)` 呼び出しを削除し、`useProgressReport`(4.2で変更後)が返す選定済み summary をそのまま `ServantPraise`/`ProgressReportContent` に渡すよう変更する(二重選定バグの排除。design.md D2b)。`components/dashboard/ProgressSection.tsx` も新API(`current`)に追随。
- [x] 5.2 `lib/progress/tier.ts` のコメント(「アンカー: 15周/日 ≈ 自然回復288AP/日」等、古いしきい値根拠の説明)を新しきい値の位置付けに合わせて更新する。
- [x] 5.3 `openspec/specs/progress-visualizer/spec.md` に本change の delta を同期する。
- [x] 5.4 `npx vitest run` / `npx tsc --noEmit` を実行し、全テストがグリーンであることを確認する。
- [x] 5.5 開発モック(`NODE_ENV=development`)で `/api/progress` を叩き(curl)、d30/d60/d90 3窓の値とブラウザでのパネル描画(コンソールエラー無し)を確認する。

## 6. サーバ/クライアントの重複計算排除(フォローアップ、レビュー指摘対応)

30/60/90日3窓化により、同一 snapshot への重複解決時にサーバ側の比較計算(新規サーヴァント検出・育成成長計算)とクライアント側の単価表解決(`resolveUnitPrices`)がそれぞれ最大3倍・6倍に増える点への対処。単一ユーザー運用のため絶対量としては軽微だが、同一入力の重複計算は素直に排除する。CDN/edgeキャッシュは`/api/progress`がセッション認証付きPOSTかつ`current`(ライブ状態)依存でキャッシュヒットしないため不採用とし、リクエスト内メモ化のみで対応した(design.md Risks/Trade-offs参照)。

- [x] 6.1 `lib/progress/snapshot.ts`: `fetchAllSnapshotsByPeriod` で同一 snapshot id への複数解決を snapshot id 単位でメモ化し、`JSON.parse` を1回だけ実行する。
- [x] 6.2 `lib/progress/summary.ts`: `buildProgressResponse` で同一 snapshot id への複数解決を snapshot id 単位でメモ化し、`buildPeriodSummary` の呼び出しを1回に抑える(period フィールドのみ差し替え)。
- [x] 6.3 `lib/progress/lap-value.ts`: `computeForwardProgress`/`computeEffortLaps` に任意の `unitPrices` 引数を追加し、呼び出し側が事前解決した単価表を渡せるようにする(省略時は従来どおり内部計算、後方互換)。
- [x] 6.4 `hooks/use-progress-report.ts`: `resolveUnitPrices` を3窓ループの前に1回だけ算出し、各窓の `computeForwardProgress`/`computeEffortLaps` に渡す。
- [x] 6.5 テスト追加: `snapshot.test.ts`(同一オブジェクト参照の検証)、`summary.test.ts`(`detectNewServants` 呼び出し回数が1回であることの検証)、`lap-value.test.ts`(`unitPrices` 指定時に内部再計算しないことの検証)。
