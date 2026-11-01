# Design

## Context

イベントページ（`app/events/[id]/page.tsx`）は、`featuresFor` が `shop` を返しロトが無いイベントを `isShopOnlyEvent` で「ロトの無い交換所イベント」と判定し、交換所の AP 換算値（`loadShopApPrices`）とポイントの品目（`getEventRewards`）を読んでから `EventHubClient` に渡す。`EventHubClient` はこのとき「交換所の周回計算」の見出しと説明の下に `EventShopList` を置く。`EventShopList` は1つの component の中で、交換回数・所持数・ボーナスの状態を持ち、全部交換と不足素材のみの操作、ボーナスの入力、1周あたりの獲得量、通貨ごとのカード（`CurrencyHeader`・`ShopTable`・`CurrencyFooter`）、周回の内訳、AP 予算を並べる。

品目の種類は `EventShopItem.kind`（`'svt'` ならサーヴァント扱い、無ければアイテム）で分かる（#179）。#204 で試した `featuresFor` の条件の変更は、一覧のバッジとイベントページの両方から交換所を消すため採らない（proposal.md の Why）。

`event-planner` の spec には未 archive の `issue-127-bug-events` が delta を持つので、この change は `event-planner` を変えず、例外を `event-shop-servant-exchange` に書く（#179 と同じ扱い）。

## Goals / Non-Goals

**Goals:**

- 品目がすべてサーヴァント扱いの交換所で、計算の部品を1つも描かず、品目の一覧だけを描く
- 一覧だけのときは、周回計算にしか使わないデータ（AP 換算値・ポイントの品目）を読まない

**Non-Goals:**

- `featuresFor`・`mergeEventList`・ダッシュボードの導線の変更（バッジは今までどおり）
- 取り込み・KV の中身・`EventShopItem` の型の変更
- アイテムの品目が1つでもある交換所の表示の変更
- 箱のあるイベント（ロト計画の中の交換所）の変更

## Decisions

### 判定は「交換所が1件以上で、すべて `kind === 'svt'`」の純粋関数にする

`lib/event-features.ts` に `isServantOnlyShop(shop)` を足す。空の交換所は真にしない（`isShopOnlyEvent` が既に偽にするので、どちらでも描画は変わらないが、関数の意味をはっきりさせる）。`kind` を持たない既存のデータはアイテムとして読むので偽になる。周回クエストの有無は見ない（issue の条件）。

代わりに `featuresFor` で `shop` を外す案は、バッジも消えるので採らない。新しい feature（例: `shop-catalog`）を足す案は、一覧のバッジとレジストリの型に手が入り、Non-Goals を越えるので採らない。

### 一覧だけの表示は、`EventShopList` とは別の component にする

`components/events/EventShopList.tsx` に `EventShopCatalog`（名前は実装で決めてよい）を足し、`groupShopByCurrency` で通貨ごとに分けたカードに、品目・個数・上限・対価の4列だけの表を描く。`EventShopList` に「一覧だけ」の props を足して各部品を条件で消す案は、状態を持つ hook（`useShopRosterPlan` の育成計画の読み込み、`useBonusTargets`、ソルバーの `planShopCurrencies`）が一覧だけのときにも動き、出さない部品を1つでも消し忘れると表示に残るので採らない。別の component にすれば、計算の hook はそもそも呼ばれない。

並びは交換所の元の順（通貨ごとのカードの中で `groupShopByCurrency` が返す順）とする。サーヴァント扱いの品目には効率が無いので、`orderShopByEfficiency` を通しても順位は付かない。

カードの見出しは `CurrencyHeader` を使い回すが、全交換の合計と上限なしの品目の数は出さない（issue の「必要な通貨の合計を出さない」に合わせる）。`CurrencyHeader` に合計を出すかの props を足すか、通貨の名前とアイコンだけの小さな見出しを別に書くかは実装で決めてよい。

1回の個数（`×qty`）は issue の「出すもの」に挙がっていないが、品目の一部（何個もらえるか）であり計算ではないので出す。

### イベントページで、一覧だけのときは周回計算のデータを読まない

`page.tsx` は `isShopOnlyEvent` が真で `isServantOnlyShop` も真のとき、`loadShopApPrices` と `getEventRewards` を呼ばない。`EventHubClient` は同じ2つの判定で、見出し「交換所の品目」と、周回計算をしないことの説明（例: 「この交換所には礼装などしか並ばないため、周回数は計算せず、品目と対価だけを並べます」）の下に一覧だけの component を置く。見出しと説明は `t('kebab-key', '日本語')` で書き、`locales/ja.json`・`locales/en.json` の両方に足す。

## Risks / Trade-offs

- [見出しの全交換の合計を消すと、礼装をすべて交換するのに要る通貨の数が画面から分からなくなる] → issue の「出さない」に従う。オーナーが合計を残したいと判断したら、PR のレビューで戻す（`CurrencyHeader` をそのまま使えば戻せる）
- [将来、礼装だけの交換所の通貨が周回で落ちるイベントが来ると、周回計算が出せるのに一覧だけになる] → issue が周回場所の有無を条件にしないと決めているので受け入れる。そうしたイベントが来たら別の issue で判定を見直す
- [一覧だけの component と `ShopTable` で、行の見た目（アイコン・名前・上限なしの表示）が二重になる] → 行のセルは既存の `Icon` と同じ i18n キー（`event-shop-unlimited` など）を使い回し、表示の食い違いを抑える

## Migration Plan

データの移行は無い。戻すときは PR を revert すれば、すべての交換所が今までどおり周回計算として表示される。
