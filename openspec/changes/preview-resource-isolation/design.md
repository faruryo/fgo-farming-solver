## Context

`wrangler.toml` は環境が 1 つで、`CLOUD_SAVE`・`MASTER_DATA`・`DB` の本番 ID をトップレベルに置いている。シークレットはダッシュボード側にある。Workers Builds の既存接続は、Worker Previews へ切り替えるまで旧プレビューのままである。旧プレビューは `wrangler versions upload` の Version URL で、本番の設定を継承する。Cloudflare の文書（2026-09-22 更新）は、Version URL をブランチや pull request の確認に使わないと書いている。

リポジトリは public で fork できる。push 権限がある collaborator は `faruryo` だけである。`.github/workflows/deploy.yml` の本番デプロイは `main` への push だけが走る。プレビューのビルドはリポジトリ内のワークフローではなく、Worker の Builds 設定である。

プレビューログイン（`preview-google-login`）は、コード交換を本番に残し、引き渡し JWT の署名を `AUTH_SECRET` とは別の `PREVIEW_HANDOFF_SECRET` にしている。戻り先の許可は `lib/preview-auth/policy.ts` の `isAllowedReturnOrigin` で、ホスト名は `<prefix>-fgo-farming-solver.<subdomain>.workers.dev` の 1 ラベルである。`jti` の消費は、完了リクエストの `env.DB` に対して行う。

`[[services]]` の `WORKER_SELF_REFERENCE` は OpenNext 用で、アプリコードからは参照していない。Worker Previews では、サービスバインディングの呼び出し先は束縛先 Worker の本番デプロイになる。

動機は proposal.md を参照。

## Goals / Non-Goals

**Goals:**

- 本番以外のブランチの実行環境から、本番の `AUTH_SECRET`、`GOOGLE_CLIENT_SECRET`、`CLOUD_SAVE`、`DB`、本番マスターデータへの書き込みを外す。
- 本番ブランチのデプロイ先は今のリソースのままにする。
- fork の pull request ではプレビューを作らない。

**Non-Goals:**

- プレビューログインの引き渡し方式を変えること。
- 本番ユーザーのデータをプレビュー用 D1 へコピーすること。
- プレビュー用マスターデータを定期更新の対象に加えること。
- GitHub Actions にプレビューデプロイのジョブを足すこと。

## Decisions

### 1. 旧プレビューを Worker Previews に切り替える

本番 Worker の Builds を、ダッシュボードの一回限りの切り替えで Worker Previews にする。切り替え後の Preview コマンドは `npx wrangler preview` とする。`wrangler versions upload` を非本番ブランチのコマンドに残さない。Wrangler は 4.135.0 以上を `package.json` に固定する。プロジェクト内の Wrangler が使われ、グローバルの新しい版は使われない。

プレビューは本番設定を継承しない。`wrangler.toml` に `previews` ブロックを置き、そこへプレビュー用のバインディングだけを書く。トップレベルの本番 ID は本番デプロイ専用のままにする。

代替は `[env.preview]` の別 Worker である。サービスバインディングが本番を叩く問題を Worker Previews で消せないときの退避先にする（Decision 5）。最初から別 Worker にすると、Builds を Worker 2 つへ繋ぎ、本番側のプレビュービルドを止める手順が増える。文書が推奨する経路は Worker Previews なので、そちらを先に取る。

切り替えは戻せない。戻したくなっても `versions upload` へは戻さず、プレビュービルドを止める。

### 2. データストアは空の専用リソースにする

次を新規に作り、`previews` の同名バインディングだけをそこへ向ける。トップレベルの ID を `previews` に書いてはならない。

| バインディング | プレビュー |
| --- | --- |
| `CLOUD_SAVE` | 空の KV |
| `DB` | 空の D1。`db/schema.sql` だけ適用する |
| `MASTER_DATA` | 本番とは別の KV。公開マスターの複製を一度入れる |

`preview_auth_jti` の消費は完了リクエストの `env.DB` なので、プレビューの完了はプレビュー D1 に入る。本番 D1 にプレビュー用の行は足さない。

マスターデータの定期ワークフローは本番 KV のままにする。プレビューの複製が古くても、公開データの表示が遅れるだけで、本番は変わらない。

### 3. シークレットはプレビュー用に入れ直す

ダッシュボードの Previews Base から本番シークレットをそのまま import しない。`npx wrangler preview base-config secret put` で次だけを入れる。

- `AUTH_SECRET`: 本番と別の値。`PREVIEW_HANDOFF_SECRET` とも別。
- `PREVIEW_HANDOFF_SECRET`: 本番と同じ値。プレビューが引き渡し JWT を検証するため。
- `PREVIEW_WORKERS_DEV_SUBDOMAIN`
- `PREVIEW_LOGIN_ALLOWED_IDS`
- `GOOGLE_CLIENT_ID`（公開値。認可 URL の組み立てに使う）

`GOOGLE_CLIENT_SECRET` は入れない。コード交換は本番のコールバックだけが行う。

引き渡しシークレットをプレビューが持っていても、本番のセッションにはならない。完了処理は audience がリクエストのオリジンと一致するときだけ Cookie を書き、署名にはその環境の `AUTH_SECRET` を使う。本番の開始ルートは workers.dev のプレビューホスト以外に nonce Cookie を置かない。Cookie は `__Host-` なので、プレビューから本番ホストへは付かない。

### 4. 戻り先ホストは実 URL に合わせ、許可範囲は広げすぎない

Worker Previews のホスト名を 1 件取り、`isAllowedReturnOrigin` が通るか確認する。今の形（アカウントのサブドメイン配下で、左端ラベルが `-fgo-farming-solver` で終わる）に収まるならコードは変えない。収まらないときだけ、その形を許可する。`https`、ユーザー情報なし、ポートなし、`pages.dev` と別 Worker 名の拒否は維持する。

### 5. サービスバインディングが本番を叩くなら別 Worker に退避する

プレビューの自己呼び出しが本番 Worker の `DB` または `CLOUD_SAVE` を読まないことを、切り替え後のプレビューで確認する。読む場合は Worker Previews を本番 Worker では使わず、次に切り替える。

- `[env.preview]` の Worker 名は `fgo-farming-solver-preview`。
- その環境の `WORKER_SELF_REFERENCE` は自分自身を指す。
- 本番 Worker の preview builds は無効にする。
- 非本番ブランチのデプロイコマンドは、プレビュー Worker に対する `npx wrangler deploy --env preview` とする。Version URL を本番 Worker に積まない。

### 6. fork はビルドしない

Workers Builds は接続したリポジトリへの push で動く。fork の pull request は上流のブランチを作らない。ダッシュボードで、プレビュービルドの対象がこのリポジトリのブランチだけであることを確認する。

`pull_request` や `pull_request_target` で `CLOUDFLARE_API_TOKEN` を使うジョブは足さない。fork のワークフローはシークレットを持たないが、`pull_request_target` は持つ。

ブランチ側の `wrangler.toml` が `previews` の ID を本番 ID に書き換えると、push できる人のプレビューは再び本番を束縛できる。CI で、`previews` 配下にトップレベルの KV ID と D1 ID が無いことを見る。これは事故防止であり、push 権限そのものの代わりにはならない。

## Risks / Trade-offs

- [切り替えは一方向] → 問題があれば preview builds を止め、Decision 5 の別 Worker へ移す。`versions upload` には戻さない。
- [自己呼び出しが本番を読む] → Decision 5。確認できるまで、この change を完了にしない。
- [プレビューのマスターデータが古くなる] → 定期更新には入れない。表示確認で必要なら手動で複製を更新する。
- [Previews Base のシークレット変更は、既に動いているプレビューへは遡らない] → 切り替え時に作り直す。古いプレビューが残るなら削除する。
- [`preview-google-login` の「本番データを書いてよい」が残る] → アーカイブ前にその文を削除する。要件の正は本 change の `preview-isolation` とする。

## Migration Plan

1. プレビュー用 KV 2 つと D1 を作る。D1 には `db/schema.sql` を適用する。本番の ID には適用しない。マスターデータ KV へは公開データの複製を一度入れる。
2. Wrangler を 4.135.0 以上にし、`previews` ブロックを足す。本番 ID はトップレベルだけに残す。
3. ダッシュボードで Worker Previews へ切り替える。本番シークレットは import せず、Decision 3 の値を入れ直す。Preview コマンドが `npx wrangler preview` であることを確認する。
4. 非本番ブランチのプレビューで、本番履歴が読めないこと、プレビュー発行のセッション Cookie が本番で拒否されること、自己呼び出しが本番データを読まないことを確認する。
5. 問題があれば preview builds を止め、Decision 5 に移す。本番の `main` デプロイは止めない。

## Open Questions

なし。ホスト名の実形は Decision 4 の確認で足り、方式は変えない。
