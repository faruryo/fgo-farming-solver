## 1. PageHeader

- [ ] 1.1 `components/common/page-header.tsx` の `PageHeader` に、任意の props を足す。戻るリンクの文言を任意にして、渡さなければ戻るリンクを出さない。戻り先（既定 `/`）、タイトルの右側に置く要素（タイトルの列の兄弟として `.c-page-header` の直下に置く）、`.c-page-header` に足すクラスを受け取る。既存の4ページ（bond・quests・todo・イベント一覧）の呼び出しは変えない。`components/common/page-header.test.tsx` を作り、文言なしで戻るリンクが出ない・戻り先を指定すると その href になる・指定しなければ `/`・右側の要素がタイトルの列の外に出る、の4通りを確かめ、判定を壊すと赤くなることを確かめてから戻し、`pnpm vitest run` が通ることで確かめる

## 2. 戻るリンクの無い見出し

- [ ] 2.1 `components/servants/index.tsx`・`components/items/index.tsx`・`components/items/item.tsx`・`components/common/doc.tsx`・`components/cloud/index.tsx`・`components/farming/index.tsx` の見出しを、戻るリンクの文言を渡さない `PageHeader` に置き換える。英字ラベルとタイトルの中身（`t()` の呼び出しを含む）は今のまま渡す。6ファイルに `c-page-en` と `c-page-title` が残っていないことを grep で確かめ、`pnpm vitest run` が通ることで確かめる
- [ ] 2.2 `components/servants/servant.tsx` の見出しを `PageHeader` に置き換え、STARS・CLASS の `.c-stats` をタイトルの右側の要素として渡す。`components/farming/result.tsx` の見出しを `PageHeader` に置き換え、公開設定と計算履歴へのリンクをタイトルの右側の要素として、今 `.c-page-header` に足しているクラスを足すクラスとして渡す。2ファイルに `c-page-en` と `c-page-title` が残っていないことを grep で確かめ、`components/farming/result.test.tsx` を含めて `pnpm vitest run` が通ることで確かめる

## 3. イベント一覧へ戻る見出し

- [ ] 3.1 `components/events/EventDataMissing.tsx` と `components/events/EventHubClient.tsx` の `Header` の見出しを、戻り先 `/events`・文言 `t('イベント一覧へ戻る')` の `PageHeader` に置き換える。`EventHubClient.tsx` の開催状況・期間・箱数・通貨の行は、タイトルの下に積む要素として渡す。2ファイルに `c-page-en`・`c-page-title` と、戻るリンクの `FaChevronLeft` が残っていないことを grep で確かめ、`pnpm vitest run` が通ることで確かめる

## 4. 確認

- [ ] 4.1 `pnpm run type-check` と `pnpm run lint:ratchet` が通ることを確かめる <!-- verify-only -->
- [ ] 4.2 置き換えの前（main）と後で、`/servants`・`/servants/<id>`・`/items`・`/items/<id>`・`/cloud`・`/farming`・計算結果のページ・ドキュメントのページ・`/events/<id>`（データあり・データ未取得）の見出しを、375px 幅を含めてブラウザで撮り、見出しの見た目が同じことを確かめる <!-- verify-only -->
