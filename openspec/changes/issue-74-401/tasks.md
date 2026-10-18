# Tasks

## 1. ソルバー実行後のスナップショット保存

- [ ] 1.1 `lib/farming/submit-solve.ts` の送信処理が、呼び出し側からログインしているかを受け取り、ログインしていなければ `saveProgressSnapshot()` を呼ばないようにする。`components/farming/index.tsx` と `components/material/result.tsx` は `useSession` の `status === 'authenticated'` を渡す。`lib/farming/submit-solve.test.ts` に、未ログインでは保存が呼ばれず結果ページへ遷移すること、ログインでは呼ばれることのテストを足して `pnpm vitest run lib/farming/submit-solve.test.ts` が通る

## 2. 計算履歴の取得

- [ ] 2.1 `hooks/use-recent-result.ts` が、`status === 'authenticated'` のときだけ `GET /api/farming/history` を呼ぶようにする。`localStorage` の結果 URL からの結果の読み込みは、ログイン状態に関係なく続ける。`loading` の間は計算履歴を取得しない。フックのテストを足し（`next-auth/react` は既存のテストと同じ形でモックする）、未ログイン・確認中では履歴の取得が送られず、ログインでは送られることを `pnpm vitest run hooks` で確かめる
- [ ] 2.2 `app/farming/history/page.tsx` が、未ログインでは計算履歴を取得せず、計算履歴はログインすると使えることと `/cloud` へのリンクを表示するようにする。確認中は取得しない。案内の文言は `locales/ja.json` と英語の翻訳に足す。ページのテストを足し、未ログインで取得が送られず案内とリンクが出ること、ログインで取得することを確かめる

## 3. 計算履歴への導線と推移グラフ

- [ ] 3.1 `components/common/nav.tsx` の「計算履歴」の項目を、`status === 'authenticated'` のときだけ出す。テストで、未ログイン・確認中では項目が無く、ログインでは有ることを確かめる
- [ ] 3.2 `components/farming/result.tsx` の「計算履歴」ボタンと推移グラフ（`HistoryGraph`）を、`status === 'authenticated'` のときだけ描画する。`components/farming/result.test.tsx` に、未ログインでは両方が描画されないこと、ログインでは描画されることを足す
- [ ] 3.3 `app/page.tsx`（ダッシュボード）の「計算履歴」リンクと推移グラフを、`status === 'authenticated'` のときだけ描画する。テストで、未ログインではリンクとグラフが描画されないことを確かめる
- [ ] 3.4 `pnpm vitest run`、`pnpm lint`、`pnpm lint:ratchet` が通ることを確かめる <!-- verify-only -->

## 4. 見た目の確認

- [ ] 4.1 Playwright の見た目のテスト（`e2e/visual.spec.ts`）を手元で走らせ、ダッシュボードの差分が「計算履歴」リンクと推移グラフの消失だけであることを確かめる <!-- verify-only -->
