# Tasks

## 1. 実シートの全見出しで、修正前の対応表を固定する（コード修正より先に行う）

- [ ] 1.1 `fetchAndTransformData` の見出しごとの照合ループ（`normalizeItemName` → 完全一致 → 部分一致）を、挙動を変えずに `lib/master-data/update.ts` から export する純関数 `matchSheetItemColumns(header: string[], aaItems)` に切り出す。戻り値は列ごとの `{ column, shortName, atlasId | null }` で、同じ素材に結び付いた2列目も落とさない。`fetchAndTransformData` はこの戻り値から従来どおり items と itemMap を作る。検証: 既存の `lib/master-data` のテストが変更なしで通ること。
- [ ] 1.2 2026-10-11 の公開シートの見出し行（CSV の index 2 の5列目以降）を `lib/master-data/__fixtures__/sheet-header-2026-10-11.json` に、Atlas JP `nice_item.json` の全行を `id` / `name` / `type` / `priority` / `background` の5項目に絞ったものを `lib/master-data/__fixtures__/nice-item-2026-10-11.json` に保存する。両 fixture を `matchSheetItemColumns` に通した結果を `lib/master-data/__fixtures__/sheet-item-columns.expected.json` に記録し、`lib/master-data/sheet-item-columns.test.ts` で結果が expected と一致することを確かめる。この時点では修正前のコードで記録するので、`ｶｹﾗ` と `ｴｰﾃﾙ` は `atlasId: null` になる。検証: テストが通り、expected の任意の1列の atlasId を書き換えると赤くなること。

## 2. 略称の全角・半角を揃える

- [ ] 2.1 `normalizeItemName` の入口で略称を NFKC にし、静的テーブルはキーを NFKC にした Map で引く。テーブルの既存キーは書き換えない。どのルールにも当たらないときは NFKC 後の略称を返す。静的テーブルに `'エーテル': 'エーテル収光体'` を足す。検証: `lib/master-data/update.test.ts` の `normalizeItemName` に、`ｶｹﾗ`→`煌星のカケラ`、`ｴｰﾃﾙ`→`エーテル収光体`、`ｴｰﾃﾙ` と `エーテル` が同じ結果になることを足す。既存の `ﾗﾝﾀﾝ`→`ゴーストランタン` などがそのまま通ること。NFKC を外すと新ケースが赤くなること。`エーテル` の静的テーブル登録を外すと `ｴｰﾃﾙ` のケースが赤くなること（Decision 2 の登録を検出できるのはこの検査だけ）。
- [ ] 2.2 `fetchAndTransformData` の部分一致フォールバックを、生の `shortName` でなく `shortName.normalize('NFKC')` で引く（`normalizeItemName` の戻り値ではない）。items に保存する `shortName` は生の表記のままにする。検証: `fetchAndTransformData` のテストに次を足す。(a) 見出しが `ｶｹﾗ` の CSV と `煌星のカケラ`（skillLvUp・gold・priority 285）を含む Atlas モックで、items に `atlasId: 6544`・`shortName: 'ｶｹﾗ'` の行があり、その列の drop_rates が出力に含まれる。(b) 静的テーブルに無い半角カナの見出しが、全角化した文字列を含む Atlas 素材に部分一致で結び付く。フォールバックを生の `shortName` に戻すと (b) が赤くなること。(c) 2素材を含まない前回ペイロードを `previous` に渡したとき、既存素材の id が前回と同じで、新しい2素材の id が既存と重複しない。
- [ ] 2.3 2.1 と 2.2 のあとで `sheet-item-columns.expected.json` を更新する。expected の差分は `ｶｹﾗ`→6544 と `ｴｰﾃﾙ`→6556 の2列だけであること（ほかの列の atlasId が1つでも変わったら NFKC 化による退行として扱い、原因を直す）。同じテストに、fixture の Atlas 素材のうち周回対象（skillLvUp・銅銀金・priority 298 以下）がそれぞれちょうど1列に結び付くことの検査を足す。検証: expected の差分が2列だけであることを PR の差分で確認できること。テストが通り、2.1 と 2.2 の NFKC 化を両方外すと、`ｶｹﾗ` と `ｴｰﾃﾙ` が `atlasId: null` に戻って expected 不一致と周回対象の検査の両方で赤くなること。`エーテル` の静的テーブル登録を外しても、部分一致で 6556 に結び付くのでこのテストは赤くならない。登録の有無は 2.1 の `normalizeItemName('ｴｰﾃﾙ')` が `エーテル収光体` を返す検査で確かめる（登録を外すと `エーテル` が返って赤くなる）。

## 3. 周回対象の欠落を更新ログに出す

- [ ] 3.1 `fetchAndTransformData` の末尾で、組み上がった items / quests / drop_rates と取得済みの Atlas 素材を `parseCraftAuditInputs` → `auditFarmableCraftGaps` → `formatFarmableCraftAudit` に通す。欠落があれば `::warning title=farmable items missing from drops::<atlasId> <name> <reason>` を欠落1件につき1行 `console.warn` する。`parseCraftAuditInputs` が null なら点検できなかった旨を `::warning::` で1行出す。どちらでも戻り値と例外の有無は変えない。検証: `update.test.ts` で、周回対象の Atlas 素材に対応する列が CSV に無いとき warning に Atlas ID と名前が出ること、全素材がそろうときは warning が出ないこと、Atlas モックに未知の `background` の行を混ぜると点検不能の warning が1件だけ出ること、いずれでも `fetchAndTransformData` が例外を投げず MasterData を返すこと。warning 条件を常に偽にするとテストが赤くなること。
- [ ] 3.2 `openspec/specs/master-data/spec.md` の更新は archive に任せる。`openspec validate normalize-sheet-item-names --strict` が通ること。

## 4. 全体確認

- [ ] 4.1 `pnpm run type-check`、`pnpm vitest run lib/master-data lib/event-craft-data-check.test.ts`、`pnpm run lint:ratchet` が通る。`stable-ids.test.ts` と `regression.test.ts` が変更なしで通り、既存素材の短縮IDが動かないこと。
- [ ] 4.2 ローカルで公開シートと Atlas JP を相手に `fetchAndTransformData({})` を1回走らせ、戻り値を JSON でスクラッチディレクトリに保存する使い捨てスクリプトを書く（リポジトリには置かない。KV へも `mocks/` へも書かない）。`https://api.atlasacademy.io/export/JP/nice_item.json` も同じディレクトリに保存し、`pnpm exec tsx scripts/audit-craft-drop-coverage.ts <保存した drops.json> <保存した nice_item.json>` が `gaps=0` / exit 0 になること。実行中に周回対象欠落の warning が出ないこと。

## 5. 本番反映の確認（マージ後）

- [ ] 5.1 `update-master-data` を workflow_dispatch で1回走らせ、KV 書き込み成功のログと、周回対象欠落の warning が無いことを確かめる。
- [ ] 5.2 本番 `all_drops_json` を `pnpm exec wrangler kv key get all_drops_json --binding MASTER_DATA --remote` の読み取りだけで取得してファイルに保存し、公開 Atlas `nice_item.json` と一緒に点検スクリプトにかけて `gaps=0` / exit 0 を確かめる。実行コマンドと結果を #120 にコメントする。本番 JSON はコミットしない。
