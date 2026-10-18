## Context

本番のマスターデータ用ストア（`MASTER_DATA`、`306bbe…`）に書くのは4つの処理である。

| 処理 | 書き方 | 値が変わらないとき |
|---|---|---|
| `update-master-data.yml` → `scripts/run-updater.ts` | `scripts/kv-rest.ts`（Cloudflare REST API、namespace は定数） | 毎回書く |
| 同じワークフロー → `scripts/run-rarity-updater.ts` | `kv-rest.ts` | 入力の指紋が同じなら書かない |
| `refresh-event-data.yml` | `wrangler kv key put` | 結果が同じなら書かない |
| `refresh-nice-war.yml` | `wrangler kv key put` | 毎回書く |

プレビュー用のストア（`wrangler.toml` の `[[previews.kv_namespaces]]` の `MASTER_DATA`、`9d4d9c…`）には誰も書かない。アプリ（`app/`・`lib/`）は `MASTER_DATA` を読むだけで、書かない。アプリが読むキーは `all_drops_json`・`dashboard_meta`・`event_data_json`・`material_catalog_v1`・`rarity_ap_tables`・`servants_list` の6つで、`nice_war_aaquests` と `rarity_ap_tables_fp` は更新処理だけが使う。

`openspec/specs/preview-isolation` は、プレビューが本番のユーザーデータとシークレットに到達しないこと、プレビューからの書き込みが本番のマスターデータに反映されないことを求め、プレビューがマスターデータの複製を読むことは許している。`scripts/preview-binding-guard.ts` は、`wrangler.toml` の `previews` に本番の ID が無いことを確かめる。

## Goals / Non-Goals

**Goals:**
- プレビュー用のストアのマスターデータを、人の手を介さずに本番の定期更新に追従させる
- 写す処理が本番のストアを書き換えられないようにする

**Non-Goals:**
- プレビューの束縛（`wrangler.toml` の `previews`）の変更
- プレビュー用の D1 とクラウド同期ストアへのデータの投入
- 更新処理だけが使うキャッシュをプレビューへ写すこと

## Decisions

### 定期更新の最後に、本番からプレビュー用へ写す（issue の案 1）

`update-master-data.yml` の最後の段で、新しいスクリプトが、アプリが読む6つのキーを本番のストアから読み、プレビュー用のストアの値と違うものだけを書く。2時間ごとの定期更新のたびに、本番にある値がプレビューへ写る。この段は、前の段が失敗しても（キャンセル・未実行を除き）走らせる。本番に入っている値はその時点の正しい値なので、写してよい。

各処理の書き込みのたびに両方へ書く形にしないのは、値が変わらないと書かない処理（rarity・event data）があり、プレビュー用にキーが無いまま埋まらないためである。本番から写す形なら、どの処理が書いたかに関係なく、プレビューは本番と同じ値に揃う。`event_data_json` は別のワークフロー（`refresh-event-data.yml`）が書くが、次の定期更新（2時間以内）でプレビューへ写る。プレビュー用には、この遅れで足りる。

採らなかった案:
- プレビューのデプロイ時に本番から写す（issue の案 2）: プレビューのビルド環境に、本番のストアを読める資格情報を置くことになる。`preview-isolation` の「プレビューは本番に到達しない」の趣旨とぶつかる
- 専用の手動同期ワークフロー（issue の案 3）: 更新のたびに人が動かす必要があり、#103 の手作業がなくならない。今すぐ揃えたいときは、既存の `update-master-data.yml` の手動実行で同じ写しが走る
- `MASTER_DATA` の全キーを一覧して写す: 将来アプリがこのストアにマスターデータ以外を置いたとき、それもプレビューへ写る。写すキーは、アプリが読む6つを明示する

### 書き込み先はプレビューの設定から読み、本番なら書かない

写す先の namespace は、`wrangler.toml` の `[[previews.kv_namespaces]]` の `MASTER_DATA` の `id` から読む（スクリプトに ID を重ねて書かない）。その値が、本番の `MASTER_DATA` の ID（`kv-rest.ts` の定数）か、`wrangler.toml` のトップレベルの KV・D1 の ID のどれかと一致したら、何も書かずに非0で終わる。読み元は `kv-rest.ts` の定数の本番の ID に固定する。

`kv-rest.ts` には、namespace を引数に取る読み書きの関数を足し、今の `kvGet`・`kvPut` は本番の namespace でそれを呼ぶ形にする。`DRY_RUN=1` では今と同じく書かない。

### 失敗の扱い

写す途中で読み書きが失敗したら、残りのキーも試したうえで非0で終わり、その回のワークフローを失敗にする。本番の値は、写す処理より前の段で書かれていて、写す処理はそれを変えない。本番に値の無いキーは、プレビュー用から消さずに飛ばす。

## Risks / Trade-offs

- [`CLOUDFLARE_API_TOKEN` がプレビュー用のストアに書けない（namespace を絞ったトークン）] → 最初の定期更新で写す段が失敗し、気付ける。トークンの権限を確かめるのは人がやること（実装 PR に書く）
- [値が大きい（`material_catalog_v1` など数 MB）] → 写すのは値が違うキーだけで、CI の帯域と KV の書き込み回数（1日最大 12 回 × 6 キー）は無料枠に収まる
- [`event_data_json` の反映が最大2時間遅れる] → プレビューの確認には足りる。急ぐときは `update-master-data.yml` を手動で実行する
