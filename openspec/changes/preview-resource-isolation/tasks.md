## 1. プレビュー用リソース

- [ ] 1.1 プレビュー用の `CLOUD_SAVE` KV、`MASTER_DATA` KV、D1 を新規作成する。ID は本番（`c621d47e509445a3a7f713702b3cb07e`、`306bbe537e9d4907809f82468df500e4`、`4bb0a615-9079-4233-b57f-a5725b9eb4da`）と違うことを確認する
- [ ] 1.2 プレビュー D1 にだけ `db/schema.sql` を適用する。本番 D1 には適用しない
- [ ] 1.3 公開マスターデータの複製をプレビューの `MASTER_DATA` KV へ一度入れる。定期ワークフローの書き込み先は本番 KV のままにする

## 2. 設定

- [ ] 2.1 `package.json` の Wrangler を 4.135.0 以上にする
- [ ] 2.2 `wrangler.toml` に `previews` ブロックを足し、`CLOUD_SAVE`・`DB`・`MASTER_DATA` を 1.1 の ID へ向ける。トップレベルの本番 ID は残す
- [ ] 2.3 `previews` 配下に本番の KV ID と D1 ID が無いことを CI で失敗させる
- [ ] 2.4 `deployment_guide.md` に、Worker Previews への切り替え、入れ直すシークレット、fork ではビルドしないことを書く

## 3. ダッシュボード

- [ ] 3.1 本番 Worker の Builds を Worker Previews に切り替える。Preview コマンドが `npx wrangler preview` であり、`wrangler versions upload` ではないことを確認する
- [ ] 3.2 Previews Base のシークレットを本番から import しない。`AUTH_SECRET` は本番と別、`PREVIEW_HANDOFF_SECRET` は本番と同じかつ `AUTH_SECRET` とは別、`GOOGLE_CLIENT_SECRET` は入れない
- [ ] 3.3 プレビュービルドの対象がこのリポジトリのブランチだけであり、fork の pull request ではプレビューが作られないことを確認する
- [ ] 3.4 `pull_request` と `pull_request_target` で Cloudflare のトークンを使うジョブを足さない

## 4. プレビューログインとの接続

- [ ] 4.1 実プレビューのホスト名を取り、`isAllowedReturnOrigin` が通るか確認する。通らないときだけ、そのホスト形を許可する。`pages.dev` と別 Worker 名は拒否したままにする
- [ ] 4.2 `preview-google-login` の「許可アカウントの本番データをプレビューから書き換えてよい」を削除する。アーカイブ時に `preview-isolation` と矛盾する文を残さない

## 5. 確認

- [ ] 5.1 非本番ブランチのプレビューで、本番にある履歴が返らないこと、プレビューで保存した同期データが本番に出ないこと、プレビュー発行のセッション Cookie を本番がログイン済みとして扱わないことを確認する
- [ ] 5.2 プレビューの自己呼び出しが本番の `DB` と `CLOUD_SAVE` を読まないことを確認する。読む場合は preview builds を止め、`[env.preview]`（`fgo-farming-solver-preview`、自己参照は自分自身、本番 Worker の preview builds は無効）へ移す
- [ ] 5.3 `main` の本番デプロイ後に、既存ユーザーの本番履歴が読めることを確認する
- [ ] 5.4 `openspec validate --change preview-resource-isolation` を通す
