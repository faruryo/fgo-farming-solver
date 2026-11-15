# Tasks

## 1. 1騎を欄のとおりに置き換える保存

- [ ] 1.1 `lib/servant-levels.ts` に、1騎の Lv・宝具Lv を欄のとおりに置き換える純粋関数を足す（design.md の決めたこと 7: 数は置き換え、`null` は消す、`lv`・`npLv` 以外の欄と、ほかの騎・知らない騎の項目は残す、残る欄が無くなった項目はキーごと消す、前の保存値が表でなければ空の表に重ねる）。`lib/servant-levels.test.ts` に、置き換え・片方を消す・両方を消す・知らない欄を残す・ほかの騎を変えない・壊れた前の値の場合を足し、`pnpm vitest run lib/servant-levels.test.ts` が通ることで確かめる
- [ ] 1.2 `hooks/use-servant-levels.ts` に、1.1 の関数を `setStored(prev => …)` で呼ぶ setter を足す。値が今の保存値と同じなら setter を呼ばない判定は呼ぶ側（2.2）に置く。`hooks/use-servant-levels.test.tsx` に、setter が1騎だけを書き換えることと、取り込みの `importLevels` の動きが変わらないことを足し、`pnpm vitest run hooks/use-servant-levels.test.tsx` が通ることで確かめる

## 2. カードのボタンと小窓

- [ ] 2.1 `components/material/servant-card.tsx` の Lv・宝具Lv の `span` をボタンに替え、値の無い所持のカードに「Lv –」のボタンを足す（未所持のカードには出さない）。ボタンの読み上げの名前は design.md の決めたこと 3、見た目は決めたこと 2。押すと、新しい省略可能な props のコールバックにサーヴァントの ID と押されたボタンの要素を渡す。ピップ・チップ・所持の切り替えの処理は変えない。`locales/ja.json`・`locales/en.json` に文言のキーを足す。`components/material/servant-card.test.tsx` に、値のある所持・片方だけ・値の無い所持（「Lv –」）・未所持（ボタンが無い）・押すとコールバックが ID とともに呼ばれ育成の値が変わらない・ボタンの名前にサーヴァント名が入る、を足し、`pnpm vitest run components/material/servant-card.test.tsx` が通ることで確かめる
- [ ] 2.2 `components/material/` に Lv・宝具Lv の小窓の部品を足す（`components/ui/dialog.tsx` を使う）。中身は design.md の決めたこと 4、欄は決めたこと 5（`lib/servant-roster-review.ts` の `readField` で読む）、フォーカスは決めたこと 6、保存は決めたこと 7・8（値が同じなら書かない）、開いている間の同期は決めたこと 9。範囲に無い欄は `aria-invalid` を付けて保存を押せなくする。テストファイルを部品の隣に足し（jsdom）、開いたときの欄の初めの値・Lv の欄へのフォーカス・保存で setter が欄のとおりの値で1回呼ばれる・空の欄が `null` で渡る・範囲に無い値（121、0、1.5、宝具Lv 6）で保存できない・値が同じなら setter を呼ばない・キャンセルと Escape で setter を呼ばない、を確かめ、`pnpm vitest run` でそのファイルが通ることで確かめる
- [ ] 2.3 `components/material/index.tsx` で、直しているサーヴァントの ID と開いたボタンの要素を1つの state に持ち、小窓を一覧に1つだけ描く（design.md の決めたこと 1）。カードへ渡すコールバックは `useCallback` で固定する。小窓を閉じたら開いたボタンへフォーカスを戻す。`components/material/index.test.tsx` に、カードのボタンで小窓が開き、保存するとそのカードの表示が開き直さずに変わる・両方を空にして保存すると「Lv –」になる・小窓を開く前は一覧に Lv・宝具Lv の入力欄が無い・閉じたあとフォーカスが開いたボタンにある、を足し、`pnpm vitest run components/material/index.test.tsx` が通ることで確かめる

## 3. 品質ゲート

- [ ] 3.1 `pnpm type-check`、`pnpm lint`、`pnpm lint:ratchet`、`pnpm vitest run` がすべて通ることを確かめる <!-- verify-only -->

## 4. 実機での確かめ（graph の後に呼び出し側が行う）

- [ ] 4.1 dev サーバー（port 3191）の `/material` を Playwright で開き、画面内だけを撮って、値のある所持のカード・値の無い所持のカード（「Lv –」）・未所持のカード・小窓を開いた状態・範囲に無い値を入れた状態を確かめる。キーボード（Tab・Enter・Escape）で開閉と保存ができ、閉じたあとフォーカスが開いたボタンに戻ることを確かめる <!-- verify-only -->
- [ ] 4.2 同じ dev の `/material` で、全騎が所持のときの `document.querySelectorAll('*').length` を数え、design.md の要素の数（全騎が所持で 29,689、増えるのは「Lv –」の最大 +474）から大きく外れていないことを確かめる <!-- verify-only -->
