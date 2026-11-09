# Tasks

## 1. 品目の行のラベルと文字色

- [x] 1.1 `components/events/EventShopList.tsx` の `RowPlanLabel` から「交換所では N 個足りない」を出すのをやめ、`RowPlan` と `useShopListRows` の `planOf` から `remainder` を外す（`lib/event-shop-summary.ts` の `allocateShortfallOnly` とその検査には手を入れない。design.md の「決めたこと」）。`event-shop-status-short` の文言を、コードのフォールバックと `locales/ja.json` で「育成にあと {{n}} 個」、`locales/en.json` で「{{n}} more for your plan」にし、`event-shop-status-remainder` を両方の locale から消す。`components/events/EventHubClient.test.tsx` と `components/events/EventShopList.test.tsx` の「あと N 個」「交換所では N 個足りない」の検査を、`specs/event-shop-roster-need/spec.md` の「交換所で埋まらない不足」「欲しい品目の要る・要らない」と `specs/event-shop-single-list/spec.md` の「まとめた行で埋まらない不足」のシナリオに合わせて直し（「育成にあと N 個」が出て、「交換所では」がどの行にも出ないこと）、`pnpm vitest run components/events` で通す
- [x] 1.2 `ShopRow` の薄い文字色の条件を、判定が「足りている（交換不要）」か「使わない」で、かつ行の交換回数が 0 のときにする。`specs/event-shop-roster-need/spec.md` の「回数を入れた行は薄くしない」の検査（回数 1 で行の文字色が「育成にあと N 個」の行と同じになり、0 に戻すと薄い文字色に戻る）を `components/events/EventHubClient.test.tsx` に足して通す

## 2. 不足のある行を上にまとめる並び

- [x] 2.1 `ShopTable` で、育成計画を使えるとき（`planOf` が値を返すとき）に、`orderShopByEfficiency` の `ranked` と `unpriced` を、行の判定が「育成にあと N 個」（`status.kind` が `short`）かで上下のグループに分ける。各グループの中の順と順位の番号は分ける前のまま保つ。両方のグループに行があるときだけ「育成に足りない品目」「そのほかの品目」のグループの見出しを出し、「効率順」「AP 換算なし」の見出しはグループごとに、そのグループに効率のある行と無い行の両方があるときだけ出す。グループの見出しと「効率順」「AP 換算なし」の見出しを見た目で見分けられるようにする（design.md の「見出しの出し方」）。新しい文言は `t()` を通し、キーを `locales/ja.json` と `locales/en.json` の両方に足す。育成計画が使えないときは今の並びのまま。`specs/event-shop-efficiency/spec.md` の「効率順の1つの一覧」の追加したシナリオ（不足のある行を上にまとめる、グループごとの見出し、不足のある行が無いとき、育成計画が使えないときは分けない、交換回数ではグループは変わらない）の検査を `components/events/EventHubClient.test.tsx` に足し、既存の並びの検査が育成計画の未設定のまま通ることとあわせて確かめる
- [x] 2.2 `useFocusAfterWantedMove` が次・前の行を決める並びを、2.1 で表に出す行の順（上のグループの効率のある行・効率の無い行、下のグループの効率のある行・効率の無い行）と同じものにする。並びは表と同じところから作る。`specs/item-want-setting/spec.md` の「不足のグループの最後の行をいらないにする」の検査を `components/events/EventHubClient.test.tsx` に足し、既存のフォーカスの検査とあわせて通す

## 3. 所持数の入力を通貨ごとのカードへ移す

- [x] 3.1 `OwnedInputs` の段をなくし、所持数の入力を `CurrencyNeeds` の通貨ごとのカードの見出しの下の「選んだ交換・必要量」の段の先頭に移す（「所持数 [入力]・選んだ交換 N・必要量 N」→「全交換 N ＋上限なし N 品目」）。入力欄の大きさと縮め方、`aria-label`、保存（`useShopSavedInputs`）と必要量の計算はそのまま使う。`data-testid` の `shop-owned-inputs` は消し、`shop-currency-needs` は残す。`components/events/EventShopList.test.tsx` の所持数の段と通貨ごとのカードの検査を `specs/event-shop-single-list/spec.md` の「通貨ごとの所持数と必要量を品目の一覧の下のカードに出す」のシナリオ（一覧の上に所持数の入力が無い、カードの中の段の順、まとめた行の回数が必要量に入る、カードで入れた所持数を保存する）に合わせて直し、`pnpm vitest run components/events` で通す

## 4. 品質ゲートと実画面

- [ ] 4.1 `pnpm lint`、`pnpm lint:ratchet`、`pnpm type-check`、`pnpm vitest run` が通る <!-- verify-only -->
- [ ] 4.2 verify skill の手順で dev server（ポート 3187）を起動し、ロトの無い交換所イベント（80632 など）の交換所を育成計画を設定した状態で 1280px と 375px で開き、「育成にあと N 個」の行が「育成に足りない品目」の見出しの下にまとまって並ぶこと、グループの見出しと「効率順」「AP 換算なし」の見出しが見た目で見分けられること、順位の番号が変わっていないこと、「交換所では N 個足りない」がどの行にも出ないこと、「足りている」「使わない」の行に回数を入れると薄い文字色でなくなること、一覧の上に所持数の段が無く、一覧の下の通貨ごとのカードで所持数を入れると必要量が変わり、読み込み直しても残ることを、スクリーンショットで確かめる。キーボードで「育成に足りない品目」の最後の行を「いらない」にすると、「そのほかの品目」の最初の行の品目名にフォーカスが移ることも確かめる。育成計画を設定していない状態でも開き、グループの見出しが出ず今の並びのままであることを確かめる <!-- verify-only -->
