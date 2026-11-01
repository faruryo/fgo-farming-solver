# Tasks

## 1. 判定

- [ ] 1.1 `lib/event-features.ts` に、design の「判定は…純粋関数にする」のとおり `isServantOnlyShop(shop)`（交換所が1件以上で、すべての品目の `kind` が `'svt'` なら真）を足す。`featuresFor`・`isShopOnlyEvent`・`mergeEventList` は変えない。`lib/event-features.test.ts` に、すべて `kind: 'svt'` なら真、アイテムの品目（`kind` 無し）が1つでも混ざれば偽、空の交換所なら偽、`farmingNodes` の有無で結果が変わらないことと、すべて `kind: 'svt'` の交換所でも `featuresFor` が今までどおり `shop` を返すことをテストし、`pnpm test lib/event-features.test.ts` が通ること

## 2. 画面

- [ ] 2.1 `components/events/EventShopList.tsx` に、design の「一覧だけの表示は…別の component にする」のとおり、品目の一覧だけを描く component を足す。通貨ごとのカードに分け、見出しは通貨の名前とアイコン（通貨名が無いときは既存の `event-shop-currency-id` の見出し）だけにし、全交換の合計と上限なしの品目の数を出さない。表の列は品目（アイコンと名前）・個数（`×qty`）・上限（0 以下なら既存の `event-shop-unlimited`）・対価の4つとし、行は交換所の元の順に並べる。交換回数・所持数・ボーナスの状態、育成計画と素材カタログの読み込み、ソルバーは使わない。新しい文言は `t('kebab-key', '日本語')` で書き、`locales/ja.json`・`locales/en.json` の両方に足す
- [ ] 2.2 `components/events/EventHubClient.tsx` で、`isShopOnlyEvent` が真で `isServantOnlyShop` も真のとき、見出し「交換所の品目」と周回計算をしないことの説明（design の例の文言）の下に 2.1 の component を置き、`EventShopList` を置かない。それ以外は今までどおり「交換所の周回計算」と `EventShopList` を置く。見出しと説明のキーを `locales/ja.json`・`locales/en.json` の両方に足す。`components/events/EventHubClient.test.tsx` に次をテストする
  - 品目がすべて `kind: 'svt'` で `farmingNodes` が空の交換所: 見出し「交換所の品目」と、品目の名前・アイコン・個数・対価・上限（上限なしを含む）が出て、交換回数の入力（`spinbutton`）・全部交換・不足素材のみ・所持数・必要量・ボーナスの入力・1周あたりの獲得量・周回の内訳・AP 予算・「計画の対象外」と必要／不要の切り替え・全交換の合計が出ない
  - 品目がすべて `kind: 'svt'` で、`farmingNodes` に対価の通貨を落とさないクエストがある交換所: 上と同じく一覧だけになる
  - 礼装とアイテムの品目が混在する交換所: 今までどおり「交換所の周回計算」と交換回数の入力・全部交換が出る
- [ ] 2.3 `app/events/[id]/page.tsx` で、design の「イベントページで…読まない」のとおり、`isShopOnlyEvent` が真で `isServantOnlyShop` も真のときは `loadShopApPrices` と `getEventRewards` を呼ばない。`app/events/[id]/page.test.tsx` に、品目がすべて `kind: 'svt'` のイベントでドロップ表とポイント報酬の読み込みが呼ばれず、アイテムの品目のあるイベントでは今までどおり呼ばれることをテストし、`pnpm test app/events` と `pnpm type-check` が通ること

## 3. 確認

- [ ] 3.1 `pnpm test`・`pnpm lint`・`pnpm type-check` がすべて通ることを確かめる <!-- verify-only -->
- [ ] 3.2 dev server を 3000/3001 以外のポートで起動し、品目がすべて礼装のイベント（KV に無ければブラウザでモックを一時的に差し替え、差し替えは commit しない）のイベントページで一覧だけが出ること、礼装とアイテムの品目が混在するイベント（80632 など）では周回計算が今までどおり出ること、`/events` のカードの交換所のバッジが変わらないことを、375px と PC 幅、日本語と英語で確かめる <!-- verify-only -->
