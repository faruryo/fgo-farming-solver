## 1. ストアを指定した読み書き

- [ ] 1.1 `scripts/kv-rest.ts` に、namespace を引数に取る読み書きの関数を足し、今の `kvGet`・`kvPut` は本番の namespace（`MASTER_DATA_NAMESPACE_ID`）でそれを呼ぶ形にする。`DRY_RUN=1` のときの振る舞い（書かない、読みはローカルのファイル）と、既存の呼び出し元（`run-updater.ts`・`run-rarity-updater.ts`）は変えない。`fetch` を差し替えた vitest のテストで、指定した namespace の URL に読み書きすること、`kvGet`・`kvPut` が本番の namespace を使うことを確かめ、URL の組み立てを壊すと赤くなることを確かめてから戻し、`pnpm vitest run` が通ることで確かめる

## 2. 本番からプレビュー用へ写す

- [ ] 2.1 写す先を決める純粋関数を作る。`wrangler.toml` の文字列から `[[previews.kv_namespaces]]` の `MASTER_DATA` の `id` を取り出し、それが本番の `MASTER_DATA` の ID か、トップレベルの KV・D1 の ID のどれかと一致するか、見つからなければ、写す先を返さず理由を返す。正しい設定・本番の ID と一致・トップレベルの別の ID と一致・`previews` に `MASTER_DATA` が無い、の4通りを vitest のテストで確かめ、判定を壊すと赤くなることを確かめてから戻す
- [ ] 2.2 写すキーを決める純粋関数を作る。アプリが読む6つのキー（`all_drops_json`・`dashboard_meta`・`event_data_json`・`material_catalog_v1`・`rarity_ap_tables`・`servants_list`）について、本番の値とプレビュー用の値から、書くキー（本番に値があり、プレビュー用と違う）と、飛ばすキー（本番に値が無い、または同じ）を返す。6つ以外のキーは扱わない。違う値・同じ値・プレビュー用に無い・本番に無いの4通りをテストで確かめ、判定を壊すと赤くなることを確かめてから戻す
- [ ] 2.3 2.1 と 2.2 と 1.1 の関数を使う実行スクリプト（`scripts/sync-preview-master-data.ts`）を作る。`wrangler.toml` を読んで写す先を決め、決まらなければ何も書かずに非0で終わる。6つのキーを本番とプレビュー用から読み、書くキーだけをプレビュー用に書く。読み書きが失敗したキーがあれば、残りのキーも試したうえで非0で終わる。書いたキー・飛ばしたキー・失敗したキーをログに出す。本番の namespace には書かない。読み書きを差し替えたテストで、写す先が本番なら書き込みが1回も起きないこと、1つのキーの失敗で残りのキーが試され非0になることを確かめ、壊すと赤くなることを確かめてから戻し、`pnpm vitest run` が通ることで確かめる
- [ ] 2.4 `.github/workflows/update-master-data.yml` の最後に、2.3 のスクリプトを `pnpm exec tsx` で実行する段を足す。前の段が失敗しても、キャンセル・未実行でなければ走らせる（rarity の段と同じ条件）。`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` は既存の段と同じ secrets を渡す。既存の段は変えない

## 3. 確認

- [ ] 3.1 `pnpm run type-check`・`pnpm run lint:ratchet`・`pnpm run check:preview-bindings` が通ることを確かめる <!-- verify-only -->
- [ ] 3.2 `DRY_RUN=1` で 2.3 のスクリプトを実行し、本番とプレビュー用の KV に書かず、写す先が `wrangler.toml` のプレビュー用の ID になり、6つのキーを扱うログが出ることを確かめる <!-- verify-only -->
