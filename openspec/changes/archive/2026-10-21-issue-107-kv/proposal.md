## Why

マスターデータを更新する定期処理は、本番のマスターデータ用ストアにだけ書き込む。プレビュー用のストアは更新されず、`material_catalog_v1` などが古いまま残る（#107）。#103 では、プレビューで絆データが出なかったため、手で値を入れた。プレビューで新しい機能を確かめるたびに、同じ手作業が要る。

## What Changes

- マスターデータの定期更新（`update-master-data.yml`）の最後に、本番のストアからプレビュー用のストアへ、アプリが読むマスターデータのキーを写す段を足す。写すのは本番に今ある値で、プレビュー用の値と同じならそのキーは書かない
- 写すキーは、アプリが読む6つ（`all_drops_json`・`dashboard_meta`・`event_data_json`・`material_catalog_v1`・`rarity_ap_tables`・`servants_list`）に限る。更新処理だけが使うキャッシュと、それ以外のキーは写さない
- 写す処理は、書き込み先が本番のストアなら書かずに失敗する。本番のストアには書かない
- 写すのに失敗したら、その回の定期更新を失敗にして気付けるようにする。本番への書き込みは取り消さない
- 手で今すぐ揃えたいときは、既にある `update-master-data.yml` の手動実行（`workflow_dispatch`）で写す
- 採らなかった案（プレビューのデプロイ時に本番から写す、専用の手動同期ワークフロー、各更新処理の書き込みのたびに両方へ書く）の理由は design に書く

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `preview-isolation`: プレビュー用のマスターデータが本番の定期更新に追従すること、そのときに本番のストアへ書かず、マスターデータ以外を写さないことを足す。

## Impact

- `scripts/kv-rest.ts`（ストアを指定して読み書きする関数）
- 新しいスクリプト（本番からプレビュー用へ写す）とそのテスト
- `.github/workflows/update-master-data.yml`（最後の段）
- Cloudflare の API トークン（`CLOUDFLARE_API_TOKEN`）が、プレビュー用のストアに書けること（人が確かめる）
