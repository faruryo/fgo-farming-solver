マージ後に人がやること（tasks に入れず、実装 PR の「人がやること」に書く）: `CLOUDFLARE_API_TOKEN` がプレビュー用のストアに書けることを確かめる。最初の定期更新（または `update-master-data.yml` の手動実行）で写す段が成功し、プレビュー用の `material_catalog_v1` が本番と同じ値になることを確かめる。

## 1. ストアを指定した読み書き

- [ ] 1.1 `scripts/kv-rest.ts` に、namespace を引数に取る読み書きの関数を足し、今の `kvGet`・`kvPut` は本番の namespace（`MASTER_DATA_NAMESPACE_ID`）でそれを呼ぶ形にする。namespace 付きの関数も `DRY_RUN=1` では通信しない（読みは登録されたローカルのファイルか null、書きはログだけ）。今の `kvGet`・`kvPut` の振る舞いと、既存の呼び出し元（`run-updater.ts`・`run-rarity-updater.ts`）は変えない。`fetch` を差し替えた vitest のテストで（`DRY_RUN` はモジュールを読み込むときに決まるので、DRY_RUN の場合は `vi.stubEnv` と `vi.resetModules` のあとに動的 import する）、指定した namespace の URL に読み書きすること、`kvGet`・`kvPut` が本番の namespace を使うこと、`DRY_RUN=1` では namespace 付きの読み書きで `fetch` が呼ばれないことを確かめ、URL の組み立てを壊すと赤くなることを確かめてから戻し、`pnpm vitest run` が通ることで確かめる

## 2. 本番からプレビュー用へ写す

- [ ] 2.1 写す先を決める純粋関数を作る。`wrangler.toml` の文字列を `smol-toml` で解析し、`[[previews.kv_namespaces]]` の `MASTER_DATA` の `id` を取り出す。本番の ID の集合は、`scripts/preview-binding-guard.ts` の `KNOWN_PRODUCTION_IDS` を export して使い、トップレベルの KV・D1 の ID を足す（ガードと同じ集合）。写す先がこの集合に入っているか、見つからなければ、写す先を返さず理由を返す。正しい設定・本番の MASTER_DATA の ID と一致・本番のクラウド同期ストアの ID と一致・トップレベルの別の ID と一致・`previews` に `MASTER_DATA` が無い・トップレベルから本番の ID を消した toml で `previews` の `MASTER_DATA` に本番の MASTER_DATA の ID（`306bbe…`）を入れた、の6通りを vitest のテストで確かめる。判定を壊すと赤くなること、とくに `KNOWN_PRODUCTION_IDS` を使わずトップレベルとだけ比べると6通り目が赤くなることを確かめてから戻す。`preview-binding-guard.ts` の判定は変えない
- [ ] 2.2 写すキーを決める純粋関数を作る。アプリが読む6つのキー（`all_drops_json`・`dashboard_meta`・`event_data_json`・`material_catalog_v1`・`rarity_ap_tables`・`servants_list`）について、本番の値とプレビュー用の値から、書くキー（本番に値があり、プレビュー用と違う）と、飛ばすキー（本番に値が無い、または同じ）を返す。6つ以外のキーは扱わない。違う値・同じ値・プレビュー用に無い・本番に無いの4通りをテストで確かめ、判定を壊すと赤くなることを確かめてから戻す
- [ ] 2.3 2.1 と 2.2 と 1.1 の関数を使う実行スクリプト（`scripts/sync-preview-master-data.ts`）を作る。`wrangler.toml` を読んで写す先を決め、決まらなければ何も書かずに非0で終わる。6つのキーを本番とプレビュー用から読み、書くキーだけをプレビュー用に書く。読み書きが失敗したキーがあれば、残りのキーも試したうえで非0で終わる。書いたキー・飛ばしたキー・失敗したキーをログに出す。本番の namespace には書かない。`dryRunLocalFiles` には何も登録しない。読み書きを差し替えたテストで、写す先が本番なら書き込みが1回も起きないこと、1つのキーの失敗で残りのキーが試され非0になることを確かめ、壊すと赤くなることを確かめてから戻し、`pnpm vitest run` が通ることで確かめる
- [ ] 2.4 `.github/workflows/update-master-data.yml` の最後に、2.3 のスクリプトを `pnpm exec tsx` で実行する段を足す。前の段が失敗しても、キャンセル・未実行でなければ走らせる（rarity の段と同じ条件）。`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` は既存の段と同じ secrets を渡す。既存の段は変えない。足した段の `if:` と `env:` が rarity の段と同じであることを、`git diff` で既存の段に差分が無いことと合わせて確かめる

## 3. 確認

- [ ] 3.1 `pnpm run type-check`・`pnpm run lint:ratchet`・`pnpm run check:preview-bindings` が通ることを確かめる <!-- verify-only -->
- [ ] 3.2 `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` を設定せずに `DRY_RUN=1` で 2.3 のスクリプトを実行し、通信せずに 0 で終わり、写す先が `wrangler.toml` のプレビュー用の ID（`9d4d9c…`）と出て、6つのキーがどれも「本番に値が無い」として飛ばされるログが出ることを確かめる <!-- verify-only -->
