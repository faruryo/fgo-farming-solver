## Why

`/material` は読み取り専用の OpenNext static-assets incremental cache にビルド時データが固定され、新サーヴァントが次回デプロイまで反映されない。一方、`/material/[className]` はリクエストごとに Atlas Academy の 60MB 超のデータを取得・解析して 503 を起こし得るため、鮮度と安定性を同時に満たす配信経路が必要である。

## What Changes

- GitHub Actions の定期更新で、サーヴァント表示情報・育成素材・アイテム情報を同一世代の軽量な Material Catalog に蒸留し、バージョン付きの単一 KV 値として保存する。
- Atlas Academy の ETag / Last-Modified を使った条件付き取得、入力検証、参照整合性検証を行い、未変更時の再処理と不完全データによる正常値の上書きを防ぐ。
- Material Catalog を JSON としてストリーム配信する API を追加し、Worker 上で大きな JSON を parse・SSR しない。
- `/material` と `/material/[className]` は静的な UI シェルから Material Catalog を取得し、ページリクエスト時の Atlas Academy 直接取得を廃止する。
- Material Catalog のサーヴァント画像情報は画面で利用する顔画像 1 枚に限定し、不要な `extraAssets` を配信しない。
- クラス別 URL を既知クラスに制限し、不正な `className` はデータ取得前に 404 とする。
- カタログ更新によって既存の `localStorage['material']`、`localStorage['posession']`、クラウド同期データのスキーマや値を変更しない。

## Capabilities

### New Capabilities

- `material-catalog`: Atlas Academy データからの軽量カタログ生成、検証済み KV 更新、バージョン管理、低 CPU のストリーム配信を定義する。

### Modified Capabilities

- `material`: 育成素材計算機が再デプロイなしで更新済みカタログを利用し、不正クラス URL を 404 としつつ既存の利用者状態を保持する要件を追加する。

## Impact

- 対象: `scripts/run-updater.ts`、master-data の変換・検証コード、`lib/data-source.ts`、新規 Material Catalog API、`app/material/**`、Material UI のデータ読込境界、関連テスト、定期更新 workflow。
- 外部システム: Atlas Academy static exports、Cloudflare Workers KV、Cloudflare Workers、GitHub Actions。
- 新しいランタイム依存関係は追加しない。既存の `MASTER_DATA` KV namespace と定期更新経路を利用する。
- 新しい公開 API と KV キーを追加するが、既存の利用者保存データおよび既存 API に破壊的変更はない。
