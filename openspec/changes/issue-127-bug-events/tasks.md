## 1. 取り込み

- [ ] 1.1 `scripts/refresh-event-data.ts` のスキップ条件を「ロトも交換所も無ければスキップ」に変える。ロトの有無と交換所（`compactShop` の結果）から、取り込むかと、ロトの無いときの `currency`（交換所の最初のエントリーの対価の通貨）・`unlimitedBoxes: false`・空のロトを決める部分を、I/O を持たない純粋関数として切り出す。ロトあり・ロト無し交換所あり・どちらも無しの3通りを vitest のテストで確かめ、`pnpm vitest run` が通ることで確かめる
- [ ] 1.2 `lib/master-data/types.ts` の `EventShopItem` に、対価の通貨の表示名とアイコンの任意項目を足し、`compactShop` で `itemMap` から引いて入れる（引けないときは入れない）。引ける・引けないの2通りをテストで確かめ、`pnpm vitest run` が通ることで確かめる

## 2. 機能の判定

- [ ] 2.1 `data/event-features.ts` の `EventFeature` に `'shop'` を足す。`lib/event-features.ts` の `featuresFor` を、KV のイベントのロトが1件以上なら `'box'`、交換所が1件以上なら `'shop'` を返す形に変え（レジストリの機能との和集合、`box` が先）、`mergeEventList` と `app/events/[id]/page.tsx` の呼び出しを合わせる。ロトのみ・交換所のみ・両方・KV なしレジストリのみの各場合を `lib/event-features.test.ts` で確かめ、`pnpm vitest run` が通ることで確かめる
- [ ] 2.2 `components/events/EventListClient.tsx` の機能バッジで、`'shop'` を「交換所」と表示する（今は `'box'` 以外がすべて料理作成になる）。`t()` のキーを `locales/ja.json` と `locales/en.json` に足し、`components/events/EventListClient.test.tsx` で交換所のバッジが出ることを確かめ、`pnpm vitest run` が通ることで確かめる

## 3. 交換所一覧

- [ ] 3.1 交換所のエントリーを対価の通貨ごとにまとめ、通貨ごとの全交換に要る合計（`costAmount × limitNum` の和。`limitNum` が 0 の品目は合計に含めず、上限なしとして数える）を出す純粋関数を作る。通貨が複数・上限なしの品目を含む・通貨名が無い場合をテストで確かめ、`pnpm vitest run` が通ることで確かめる
- [ ] 3.2 交換所一覧のコンポーネントを作り、`components/events/EventHubClient.tsx` で `'shop'` があって `'box'` が無いときだけ出す。通貨ごとに通貨名（無ければ ID）と合計を見出しにし、品目の名前・1回の個数・在庫上限・1回の対価を並べる。画面の文字列は `t('kebab-key', '日本語')` で書き、locales に足す。ロトの無いイベントで一覧が出てボックス計画が出ないこと、ロトのあるイベントで一覧が出ないことをコンポーネントテストで確かめ、`pnpm vitest run` が通ることで確かめる

## 4. 確認

- [ ] 4.1 `pnpm run type-check` と `pnpm run lint:ratchet` が通ることを確かめる <!-- verify-only -->
- [ ] 4.2 取り込みスクリプトを KV に書かずにファイル出力だけで実行し（`BACKFILL_SINCE` を `80632` の開始より前にする）、`80632` が出力に入り、交換所の各エントリーに対価の通貨名が入ることを確かめる（Atlas への通信が要る） <!-- verify-only -->
