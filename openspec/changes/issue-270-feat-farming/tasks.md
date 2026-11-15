# Tasks

## 1. 周回計算の API

- [x] 1.1 `app/api/solve/route.ts` で、ストック込みの計算であることを示す引数（`stockIncluded=true`）を受け取り、真のときだけ保存する計算の `params` に印を入れる。ストック込みの目標を別の引数（`itemsStock`）で受けて 2 件を保存する経路と、それだけが使う補助の関数を消し、その引数が来ても無視して 1 件を保存する。`app/api/solve/route.test.ts` に「引数が真なら保存した結果の印が真」「引数なし・真以外なら印なし」「`itemsStock` を送っても 1 件だけ保存され、応答に組の ID が無い」のテストを足し、`pnpm exec vitest run app/api/solve` が通ることで確かめる。今の `route.test.ts` には `GET` を通すテストが無いので、`getDrops`・`auth`・`getCloudflareContext`（DB の `prepare`/`bind`/`run`）のモックを足して `GET` を通す（真以外の値は `1`・`false`・空文字で試す）

## 2. 育成計算機からの送信

- [x] 2.1 `lib/farming/build-solve-params.ts` の `buildSolveParams` で、周回目的が「新規サーヴァントに備える」（旧呼び出しの `stockEnabled` を含む）のとき、返す引数に `stockIncluded=true` を付ける。それ以外の目的では付けない。`lib/farming/submit-solve.ts` のコメントに残る `itemsStock` への言及を今の動きに合わせる。`lib/farming/build-solve-params.test.ts` に「`reserve` なら付く」「`training`・`all` なら付かない」「在庫基準が効かず目標が同じでも `reserve` なら付く」のテストを足し、`pnpm exec vitest run lib/farming` が通ることで確かめる
- [x] 2.2 `components/material/result.test.tsx` に「`reserve` で送った要求に `stockIncluded=true` が付き、`training` では付かない」のテストを足し（`components/material/result.tsx` は変えない）、`components/farming/index.test.tsx` に「手入力の送信には `stockIncluded` が付かない」のテストを足して、`pnpm exec vitest run components/material/result.test.tsx components/farming/index.test.tsx` が通ることで確かめる

## 3. 全体の確かめ

- [ ] 3.1 `pnpm exec vitest run`・`pnpm type-check`・`pnpm lint` が通ることを確かめる <!-- verify-only -->
- [ ] 3.2 dev サーバーを起動してログインした状態で、周回目的を「新規サーヴァントに備える」にして育成計算機から周回計算へ送り、結果ページに「ストック込み」の札が出ること、計算履歴ページの一覧に札が出ること、計算履歴ページとダッシュボードのグラフで「通常 / ストック込み」の切り替えが出て、その計算が「ストック込み」側にだけ入ることを確かめる。続けて「今の育成を進める」で送った計算が「通常」側にだけ入ることを確かめる <!-- verify-only -->
