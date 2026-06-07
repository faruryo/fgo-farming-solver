## 1. サーバ側（根治）

- [x] 1.1 `lib/progress/summary.ts` の `buildPeriodSummary` に degenerate 判定を追加する。`snapshot != null` でも `extractChaldeaState`（material）と `extractPosession`（posession）がともに無い場合は `fallback: 'no_snapshot_for_period'` を返す（`hasAnyPastSnapshot` に応じた既存の fallback 分岐と整合）。
- [x] 1.2 `lib/progress/summary.test.ts` に、degenerate スナップショット（`{items,quests}` のみ）が fallback 扱いになり、growthTotal/reducedAp 経路に進まないことのテストを追加する。

## 2. クライアント側（多層防御）

- [x] 2.1 `lib/progress/select-baseline.ts` の `selectBaseline` を、`!fallback` かつ「比較に使える中身がある（`pastPosession` を持つ、または material 由来の進捗を生む）」期間を優先採用するよう変更する。全期間 fallback 時のメッセージ用フォールバック（`ordered[0]`）は維持する。
- [x] 2.2 `lib/progress/select-baseline.test.ts` に、degenerate な期間（fallback 無し・中身無し）が baseline に選ばれず、フルデータを持つ別期間が採用されることのテストを追加する。

## 3. 検証

- [x] 3.1 `pnpm run type-check` / 関連 vitest を通す（progress 38 件 PASS、tsc クリーン）。
- [ ] 3.2 ローカル or 実環境で `/api/progress` レスポンスを確認し、baseline が degenerate 期間に解決されないことを目視確認する（[[feedback_verify_before_push]] に従い実物確認してから push）。

## 4. 本番データ後始末（マージ・デプロイ後）

- [x] 4.1 デプロイ反映を確認後（commit 5acfe45 → 2026-06-06T18:01 UTC デプロイ）、本番 D1 のレガシー残骸 4 行を削除した（changes=4 success=True）。残りは material/posession を持つフルスナップショット 3 件（06-02/06-03/06-06）のみ。
- [ ] 4.2 ダッシュボードで baseline が `previous`（06-06 フルデータ）に切り替わり、reducedAp/育成総量が表示されることを確認する（ユーザーのログインセッションが必要）。
