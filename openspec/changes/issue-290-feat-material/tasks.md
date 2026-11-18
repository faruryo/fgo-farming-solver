## 1. カードから所持済みのボタンを外す

- [ ] 1.1 `components/material/servant-card.tsx` で、所持済みのときは `.c-servant-controls` ごと描かず、未所持のときだけ「未所持」ボタン（押すと所持にする）を出す。`app/globals.css` の使われなくなった `.c-owned-btn.on` を消す。`components/material/servant-card.test.tsx` に「所持済みのカードに所持を切り替えるボタンが無い」「未所持のカードの『未所持』を押すと所持になり、ボタンが消える」のテストを足し、`pnpm vitest run components/material/servant-card.test.tsx` が通ることを確かめる

## 2. 小窓に「未所持に戻す」を足す

- [ ] 2.1 `components/material/servant-level-dialog.tsx` の下のボタン列にだけ「未所持に戻す」を足す（Lv・宝具Lv の欄は変えない）。主操作の「保存」と区別できる控えめな見た目にし、押したら書きかけの値を保存せずに未所持にする通知を出して小窓を閉じる。`components/material/servant-level-dialog.test.tsx` に「押すと通知が1回出て保存の通知は出ない」「書きかけの Lv があっても保存されない」のテストを足し、`pnpm vitest run components/material/servant-level-dialog.test.tsx` が通ることを確かめる
- [ ] 2.2 `components/material/index.tsx` で小窓の通知を受け、該当サーヴァントの所持の印だけを未所持に反転させる（Lv・宝具Lv と育成計画の値は変えない）。閉じ終わったら、フォーカスをそのカードの「未所持」ボタンへ移す。`components/material/index.test.tsx` に「小窓から未所持に戻すとカードが未所持になり、Lv・宝具Lv と現在値・目標値が残る」「再び『未所持』で所持にすると前の現在値が出る」「フォーカスが『未所持』ボタンへ移る」のテストを足し、`pnpm vitest run components/material/index.test.tsx` が通ることを確かめる

## 3. 全体の確かめ

- [ ] 3.1 `pnpm type-check`、`pnpm lint`、`pnpm vitest run components/material` が通ることを確かめる <!-- verify-only -->
- [ ] 3.2 dev server で `/material` を開き、所持・未所持が混ざる一覧の見た目と `#svt-<id>` へ飛んだときの位置を 1280px と 375px で確かめ、所持済みカードのボタンを外す前後の一覧の DOM 要素数（`document.querySelectorAll('*').length`）を数えて実装 PR に書く <!-- verify-only -->
