# Tasks

## 1. 計算

- [ ] 1.1 `lib/event-shop-summary.ts` に、design の決定 1・2・4 の純粋関数を足す。1つ目は、総必要数（atlasId → 個数）と所持数（atlasId の文字列 → 個数）から素材ごとの不足（0 未満は 0）を出す。2つ目は、品目の状態（足りている・あと N 個・育成計画で使わない）を出す。3つ目は、交換所と不足から、要る分の交換回数（交換所の配列の添字 → 回数）と、素材ごとに交換所で埋まらない残りを返す。4つ目は、要約（交換所に品目のある不足の素材の数と、そのうち埋まる数）を出す。`lib/event-plan.ts` の `allocateShop` は使わず、変えない。`lib/event-shop-summary.test.ts` に、spec の各シナリオの数値（不足 5・在庫上限 10、1回3個、同じ素材の品目が2つで 3 と 2、在庫上限なしで 7、不足 15・在庫上限 10 で残り 5、要約 3 素材のうち 2）と、礼装と必要数 0 の素材が「育成計画で使わない」になること、QP（atlasId 1）の品目が対象から外れる（ラベルなし・0 回・要約に数えない）こと、所持数が文字列でも数として扱うことをテストする。fixture は手で書く

## 2. 画面

- [ ] 2.1 `components/events/EventShopList.tsx` で、`useRosterNeed()` と所持数（`STORAGE_KEYS.POSSESSION`、`lazyWrite: true`）を読み、design の決定 3〜6 のとおりにする。品目の行にラベルを出し、「全部交換」の隣に「要るものだけ交換」と説明の1行を足し、要約か、未設定（`/material` へのリンク）・読み込み中・失敗の1行を出す。育成計画と所持数は書き換えない。育成計画や所持数が変わっても交換回数は変えない。文言は `locales/ja.json` と `locales/en.json` に足し、ラベルは品目名の下に折り返して 375px で横スクロールを出さない。`components/events/EventHubClient.test.tsx` に、`useRosterNeed` をモックし、localStorage に所持数を入れて、次を確かめるテストを足す
  - `ready` で、品目に「あと N 個」「足りている（交換不要）」「育成計画で使わない」が出る
  - 要るものだけ交換を押すと、交換回数が不足の分になり、足りている品目は 0 になり、周回の内訳が出る。押した後に交換回数を手で変えられる
  - 在庫上限で埋まらない素材に「交換所では N 個足りない」が出て、要約の数が合う
  - `empty` で、ラベルと要約が出ず、要るものだけ交換が押せず、`/material` へのリンクが出て、全部交換は押せる
  - `error` と `loading` で、要るものだけ交換が押せない
  - 所持数は `POSSESSION` から読み、`ITEMS` に別の値を入れても判定に使われない（`components/events/EventCraftSection.test.tsx` と同じ方法）
  - `POSSESSION` の localStorage の値が書き換わらない

## 3. 確認

- [ ] 3.1 `pnpm test --run`、`pnpm run lint:ratchet`、`pnpm run type-check` が通ることを確かめる <!-- verify-only -->
