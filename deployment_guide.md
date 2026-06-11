# FGO Solver OpenNext 移行・デプロイガイド

このドキュメントでは、FGO Farming Solver を最新の **Cloudflare Workers (with Static Assets)** 環境へ OpenNext を使用してデプロイするための手順をまとめています。

## 🚀 推奨：Cloudflare Workers でのデプロイ手順

Cloudflare の最新の推奨（Workers Assets）に基づき、OpenNext を使用して Workers としてデプロイします。

1. **ビルドとデプロイ**

ターミナルで以下のコマンドを実行するだけで、ビルドとデプロイが一括で行われます：

```bash
npm run deploy
```

内部的には `pnpm exec @opennextjs/cloudflare build` と `pnpm exec wrangler deploy` が実行されます。

### 2. GitHub 連携による自動デプロイ (CI/CD) 【推奨】

GitHub に push するだけで、メインアプリと rarity worker が自動的にデプロイされます（master-data 更新は worker ではなく定期ワークフローが担当。下記「マスターデータの自動更新」参照）。

#### A. GitHub Secrets の設定
リポジトリの **[Settings] > [Secrets and variables] > [Actions]** に以下の Secret を登録してください：

| Secret 名 | 説明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Cloudflare 編集用トークン](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ダッシュボードの右側に表示されている ID |

#### B. ワークフローの構成
`.github/workflows/deploy.yml` に記述されている内容は以下の通りです。

```yaml
# (前略)
      - name: Deploy Main App
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### 🚩 事前準備（重要）

デプロイ前に **Cloudflare KV** および **D1** の作成が必要です。

#### 1. Cloudflare KV の作成

ターミナルで以下のコマンドを実行します：

```bash
# ユーザー設定保存用
pnpm exec wrangler kv namespace create "CLOUD_SAVE"

# マスターデータ（ドロップ率）保存用
pnpm exec wrangler kv namespace create "MASTER_DATA"
```

実行後、表示される `id` を `wrangler.toml` の `[[kv_namespaces]]` セクションにそれぞれ記述してください。

#### 2. マスターデータの自動更新（GitHub Actions）

マスターデータ(`all_drops_json` / `dashboard_meta` / `servants_list`)の更新は GitHub Actions の定期ワークフローが行います（旧 fgo-data-updater cron worker は廃止済み。Workers 無料プランは公称 CPU 10ms 超の invocation を確率的に kill するため、worker では実行しない）:

- `.github/workflows/update-master-data.yml` — 30分ごと。`scripts/run-updater.ts` を実行し Cloudflare REST API で KV を更新
- `.github/workflows/refresh-nice-war.yml` — 6時間ごと。nice_war(23MB)の compact マッピングを KV (`nice_war_aaquests`) へ

前提: リポジトリ secrets の `CLOUDFLARE_API_TOKEN` に **Workers KV Storage:Edit** 権限が必要です。Atlas が空応答を返したり fetch が落ちた場合は、KV 保護層（validation）が働いて既存の正常データを温存します。

緊急で即時更新が必要なときは、GitHub の Actions タブから各ワークフローを "Run workflow" で手動発火できます。

#### 3. Cloudflare D1 (データベース) の作成

計算結果の履歴保存に使用する D1 データベースを作成します。

```bash
pnpm exec wrangler d1 create fgo-farming-solver-db
```

表示された `database_id` を **`wrangler.toml`** の `[[d1_databases]]` セクションに記述してください。

次に、データベースのテーブルを初期化します：

```bash
# ローカル開発用
pnpm exec wrangler d1 execute fgo-farming-solver-db --local --file=db/schema.sql

# 本番環境用
pnpm exec wrangler d1 execute fgo-farming-solver-db --remote --file=db/schema.sql
```

#### 4. Google OAuth クライアントの発行

1. [Google Cloud Console](https://console.cloud.google.com/) > **API とサービス** > **認証情報** > **OAuth 2.0 クライアント ID** を作成。
2. 承認済みリダイレクト URI に以下を追加：
   ```
   https://<your-domain>/api/auth/callback/google
   ```

#### 5. シークレットの設定

以下のシークレットを `pnpm exec wrangler secret put <変数名>` コマンド、または Cloudflare ダッシュボードから設定してください。

| 変数名 | 説明 | 生成・取得方法 |
|---|---|---|
| `AUTH_SECRET` | Auth.js 用シークレット | `openssl rand -base64 32` で生成 |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | Google Cloud Console から取得 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | Google Cloud Console から取得 |

---

## 🚀 デプロイ手順

### 1. ビルドとデプロイ

`wrangler.toml` の ID 設定と、D1 の初期化が完了していれば、以下のコマンドでデプロイが行われます：

```bash
pnpm run deploy
```

---

## ❓ トラブルシューティング

### `D1_ERROR: no such table: farming_results`
D1 の初期化（`wrangler d1 execute`）が行われていません。上記の「Cloudflare D1 の作成」の手順を実行してください。

### `KV namespace 'YOUR_KV_NAMESPACE_ID' is not valid. [code: 10042]`
`wrangler.toml` の `id` がデフォルトのままになっています。手順に従って作成した KV の ID に書き換えてください。

---

## 🛠️ ローカル開発

### 1. マスターデータの更新
ローカルの `mocks/all.json` を最新のスプレッドシートの内容に更新します：

```bash
pnpm update-data
```

### 2. プレビュー
OpenNext の環境をローカルでシミュレートして動作確認を行う場合は、以下のコマンドを使用します：

```bash
pnpm exec wrangler dev
```
