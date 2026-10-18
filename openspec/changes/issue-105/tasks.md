# Tasks

## 1. 見積もりのロジック

- [ ] 1.1 `lib/bond/` に、ストームポッド消費なし期間の残り秒数・実効AP・周回数から「無料と数える周回数」（期間の残り時間 × 288AP ÷ 実効AP の切り捨て、周回数を上限）を求める純粋関数と、同じ期間に含まれる複数のクエストで期間中の AP を必要 AP の割合で分ける純粋関数を足す（design の決定 1・2・3）。AP の1日あたりの値は `lib/bond/progress.ts` の `AP_PER_DAY` を使う。spec のシナリオ（残り5日で12周→0個、残り1日で12周→5個、2,880AP を 6,000:2,000 で分けて 54周と18周、終わりが2日と10日の2つの期間で14周と57周）と、実効APが0のクエスト（全周が無料、分け合いに入らず、NaN にならない）をユニットテストにする
- [ ] 1.2 `lib/bond/estimate.ts` の `groupByQuest` と `lib/bond/entry-estimate.ts` の `estimateEntry` が、questId から期間の終わり（秒）を引ける入力と `nowSec` を受け取り、1.1 の関数で `pods` を決めるようにする。入力が無いとき（期間のデータが無い）は従来と同じ結果になることを、既存のテストが変わらず通ることと、新しいテストで確かめる。`groupByQuest` は分け合いあり、`estimateEntry` はサーヴァント単独で決める
- [ ] 1.3 到達見込み（`timeToGoal`）に渡す合計のポッドが 1.2 の値になることと、ポッドが0個になったときボトルネックが AP になることをテストで確かめる

## 2. 画面

- [ ] 2.1 `components/bond/use-bond-tracker.ts` で `useDashboardMeta` と `useDashboardMeta` の `podFreePeriods` から、`useActiveCampaigns` の `nowSec` で有効な期間を選び、1.2 の入力（questId → 期間の終わり。複数の期間に含まれるときは遅いほう）を作って見積もりに渡す（`usePodFreeQuests` の `questIds` は候補の印に使う）。期間のデータが無いときは空の入力にする。`components/bond/use-bond-tracker.test.tsx` のモックに `useDashboardMeta` を足す
- [ ] 2.2 `components/bond/servant-card.tsx` の候補の `QuestIdentity` に、期間中のクエストなら `podFree` を渡す。候補の並び順は変えない。ストームポッドを消費するクエストでは、0個になってもストームポッドの欄を出す（今の `result.pods > 0` の条件を変える）
- [ ] 2.3 無料と数えた周回があるとき、見積もりタブ（`components/bond/estimate-table.tsx`）に「ポッド無料期間に自然回復で回せる N 周を0個と数えています（M/D HH:mm まで）」の注記を1行出す（N は全クエストの合計、日時は無料と数えたクエストの期間の終わりのうち一番遅いもの）。文言は `locales` の既存の絆トラッカーの文言と同じ扱いで足す

## 3. 品質ゲート

- [ ] 3.1 `pnpm test --run`、`pnpm lint`、`pnpm type-check`が通ることを確かめる <!-- verify-only -->

## 4. 画面の確認

- [ ] 4.1 `pnpm dev`（`--webpack` は付けない）で絆トラッカーを開き、確認のときだけ `mocks/dashboard.json` の `podFreePeriods` に、現在を含み冠位研鑽戦を対象にした期間を足して（commit しない）、375px と desktop の幅で、候補にポッド無料の印が付くこと、ポッド数が無料と数えた分だけ減ること、注記が出ること、期間を外すと元の表示に戻ることを確かめ、スクリーンショットを実装 PR に載せる <!-- verify-only -->
