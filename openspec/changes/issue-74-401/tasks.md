# Tasks

## 1. ソルバー実行後のスナップショット保存

- [ ] 1.1 `lib/farming/submit-solve.ts` の送信処理が、呼び出し側からログインしているかを必須の引数で受け取り（渡し忘れを型エラーにするため既定値を付けない）、ログインしていなければ `saveProgressSnapshot()` を呼ばないようにする。`components/farming/index.tsx` と `components/material/result.tsx` は `useSession` の `status === 'authenticated'` を渡す。ログイン状態の確認中に送信ボタンを無効にする今の動き（farming-history の「認証状態読み込み中の周回計算送信抑止」）は変えない。`lib/farming/submit-solve.test.ts` に、未ログインでは保存が呼ばれず結果ページへ遷移すること、ログインでは呼ばれることのテストを足す。`components/farming/index.test.tsx` と `components/material/result.test.tsx`（どちらも `useSession` と `saveProgressSnapshot` をモック済み）に、`unauthenticated` では送信後に保存が呼ばれず、`authenticated` では呼ばれることを足す。`pnpm vitest run lib/farming components/farming components/material` が通る

## 2. 計算履歴の取得

- [ ] 2.1 `hooks/use-recent-result.ts` が、`status === 'authenticated'` のときだけ `GET /api/farming/history` を呼ぶようにする。`status === 'loading'` の間は、`localStorage` の結果 URL からの読み込みも含めて何も取得せず `loading: true` を返し、確認が終わってから一度だけ読む（FarmingWizard などが確認中に件数 0 で表示されて消えるのを防ぐ）。確認後の `localStorage` の結果 URL からの読み込みは、ログイン状態に関係なく行う。`hooks/use-recent-result.test.ts` を足し（`next-auth/react` は既存のテストと同じ形でモックする）、確認中は何も取得せず `loading` が true のままであること、未ログインでは履歴の取得が送られず結果 URL からの読み込みだけが行われること、ログインでは履歴を取得することを `pnpm vitest run hooks/use-recent-result.test.ts` で確かめる
- [ ] 2.2 `app/farming/history/page.tsx` が、未ログインでは計算履歴を取得せず、計算履歴はログインすると使えることと `/cloud` へのリンクを表示するようにする。確認中は取得しない。案内の文言は `t('<key>', '<日本語フォールバック>')` で出し、キーを `locales/ja.json` と `locales/en.json` の両方に足す。`app/farming/history/page.test.tsx` を足し、未ログインで取得が送られず案内とリンクが出ること、ログインで取得することを `pnpm vitest run app/farming/history` で確かめる

## 3. 計算履歴への導線と推移グラフ

- [ ] 3.1 `components/common/nav.tsx` の「計算履歴」の項目を、`status === 'authenticated'` のときだけ出す。`components/common/nav.test.tsx` を足し、未ログイン・確認中では項目が無く、ログインでは有ることを `pnpm vitest run components/common/nav.test.tsx` で確かめる
- [ ] 3.2 `components/farming/result.tsx` の「計算履歴」ボタンと推移グラフ（`HistoryGraph`）を、`status === 'authenticated'` のときだけ描画する。`components/farming/result.test.tsx` に `next-auth/react` のモックを既存のテスト（`components/farming/index.test.tsx`）と同じ形で足し（無いと `useSession` が例外を投げて既存のテストが落ちる）、未ログインでは両方が描画されないこと、ログインでは描画されることを足す。`pnpm vitest run components/farming/result.test.tsx` が通る
- [ ] 3.3 `app/page.tsx`（ダッシュボード）の「計算履歴」リンクと推移グラフを、`status === 'authenticated'` のときだけ描画する。`app/page.test.tsx` を足し、未ログインではリンクとグラフが描画されず、ログインでは描画されることを `pnpm vitest run app/page.test.tsx` で確かめる
- [ ] 3.4 `pnpm vitest run`、`pnpm lint`、`pnpm lint:ratchet` が通ることを確かめる <!-- verify-only -->

## 4. 見た目の確認

- [ ] 4.1 Playwright の見た目のテスト（`e2e/visual.spec.ts`）を手元で走らせ、ダッシュボードの差分が次の5つだけであることを確かめる: 「計算履歴」リンクの消失、推移グラフの消失、FarmingWizard の表示、NearGoalSection と RecommendedQuest が直近の結果なしの表示になること（開発環境では履歴と結果のモックが未ログインでも返っていたため） <!-- verify-only -->
- [ ] 4.2 変更した4画面（ナビゲーション、周回結果画面、ダッシュボード、計算履歴ページ）を、375px 幅と desktop 幅のブラウザ実画面で、未ログイン・ログイン状態の確認中・ログインの3つの状態について確かめる。見るのは、確認中に「計算履歴」の導線と推移グラフが出ず、確認後にちらつかずに状態どおりの表示へ移ること、375px 幅のナビゲーションメニューで「計算履歴」の項目が未ログインでは無くログインでは有ること、未ログインの周回結果画面にボタンとグラフが無いこと、未ログインで計算履歴ページを開くと案内と `/cloud` へのリンクが出ること、ログインでは4画面ともこれまでどおり表示されること（fgo の AGENTS.md の UI 実画面確認の規則） <!-- verify-only -->
