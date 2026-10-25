# Tasks

## 1. 基準の計算

- [ ] 1.1 `lib/event-shop-summary.ts` の `currencyApThresholds` を、`farmingNodes` と通貨ごとの前提の必要量（atlasId → 個数）を受け取り、design の決定 1・2 のとおり出す純粋関数に変える。手順は、連続の LP を1回解き、通貨ごとに必要量を +1 して解き直し、`javascript-lp-solver` の `Solve` の `result` の増分を取る。絶対値 1e-9 未満と負の値は 0 にする。周回で集められない通貨と、LP が解けないときは基準を出さない。あわせて、交換所と所持数から全部交換の前提の必要量（在庫上限のある品目の `costAmount × limitNum` の和から所持数を引き、0 未満は 0）を出す純粋関数を足す。`lib/solver.ts` と `lib/event-plan.ts` は変えない。`lib/event-shop-summary.test.ts` の `currencyApThresholds` のテストを書き換え、次を確かめる。fixture は手で書く
  - spec の例: A（AP 40、X 10・Y 10）と B（AP 40、X 20）で、必要量 X 100・Y 50 なら Y 2・X 2
  - A だけで同じ必要量なら Y 0・X 4
  - 1つの通貨だけが落ちるクエストでは、今の基準（`ap ÷ perRun` の最小）と同じ値になる
  - 周回で落ちない通貨には基準が出ない
  - 前提の必要量の関数が、在庫上限の無い品目を数えず、所持数を引き、0 未満を 0 にする

## 2. 画面

- [ ] 2.1 `components/events/EventShopList.tsx` で、1.1 の前提の必要量（交換所と所持数から求め、交換回数の入力は使わない）を `currencyApThresholds` に渡す。`useMemo` の依存に交換回数を入れない。区切りの文言に「同時に落ちる他の通貨の分を差し引いた値」の注記を添え、基準が 0 のときは「他の通貨を集める周回のついでに足りる」ことを添える（design の決定 4・5）。文言は `locales/ja.json` と `locales/en.json` に足し、注記は区切りの行の下に折り返して 375px で横スクロールを出さない。`components/events/EventHubClient.test.tsx` に、次を確かめるテストを足す
  - 2つの通貨が同じクエストで落ちるイベントで、区切りの基準が同時に落ちる分を差し引いた値になる
  - 品目の交換回数を変えても、区切りの位置と基準の値が変わらない
  - 基準が 0 の通貨のカードで、すべての品目が区切りの上に並び、0 の理由が添えられる

## 3. 確認

- [ ] 3.1 `pnpm test --run`、`pnpm run lint:ratchet`、`pnpm run type-check` が通ることを確かめる <!-- verify-only -->
