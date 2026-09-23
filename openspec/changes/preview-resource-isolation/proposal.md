## Why

Workers Builds のプレビューは、本番と同じ Worker のバージョンとして動いている。未マージのブランチが本番の `AUTH_SECRET` と `GOOGLE_CLIENT_SECRET`、および本番の `CLOUD_SAVE` と `DB` を持ったまま動く。セッションを偽造でき、本番ユーザーのデータを読み書きできる。#90 のプレビューログインは、この分離と組み合わせる前提である。

## What Changes

- 本番以外のブランチは、本番のシークレットと本番の KV / D1 を持たないプレビューとして出す。Version URL（`wrangler versions upload`）を PR 確認に使わない。
- プレビューの `CLOUD_SAVE` と `DB` は空の専用リソースにする。本番の ID をプレビュー設定に書かない。
- プレビューの `AUTH_SECRET` は本番と別の値にする。`GOOGLE_CLIENT_SECRET` はプレビューに置かない。コード交換は本番だけが行う。
- このリポジトリへ push できない PR（fork）ではプレビューをビルドしない。push できるのは現時点でオーナーだけである。
- `preview-google-login` が「許可アカウントの本番データをプレビューから書き換えてよい」としている許容は取り下げ、この change の要件に置き換える。

## Capabilities

### New Capabilities

- `preview-isolation`: プレビュー実行環境が本番のシークレットとユーザーデータに到達できないこと。

### Modified Capabilities

- なし。`preview-auth` はまだ `openspec/specs/` に無く、`preview-google-login` の change 内にある。本番データへの書き込み許容は、その change をアーカイブするときにこの capability へ合わせて消す。

## Impact

- `wrangler.toml` にプレビュー用のバインディングを足す。Wrangler は Worker Previews の要件である 4.135.0 以上に上げる。
- 本番 Worker の Builds は、既存プロジェクト向けの旧プレビュー（本番設定を継承する）から Worker Previews へ切り替える。この切り替えは戻せない。
- プレビュー用の KV と D1 を新規に作る。本番 D1 へプレビューのデータを書かない。
- ダッシュボードのシークレットと Builds の Preview コマンドはリポジトリ外の作業になる。`deployment_guide.md` に手順を残す。
- GitHub Actions の `deploy.yml` は `main` への push だけが本番デプロイする。この条件は変えない。
