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

### 2. GitHub 連携による自動デプロイ (CI/CD)

Cloudflare Workers では、GitHub Actions を利用したデプロイが最も一般的で推奨される方法です。本プロジェクトは **pnpm** に移行しており、クロスプラットフォームでの依存関係不整合を避ける設定（`supportedArchitectures`）が導入されています。

#### A. Cloudflare ダッシュボードでの連携
1. **GitHub リポジトリの接続**:
   - [Cloudflare ダッシュボード](https://dash.cloudflare.com/) > **[Workers & Pages]** > **[作成]** > **[Git に接続]** を選択。
   - 本プロジェクトのリポジトリを選択します。
2. **Workers ビルド設定の入力**:
   - **ビルドコマンド**: `pnpm run build`
   - **デプロイコマンド**: `pnpm exec wrangler deploy`
   - **ルートディレクトリ**: `/`
3. **[保存してデプロイ]** をクリック。

#### B. GitHub Actions による自動デプロイ
`.github/workflows/deploy.yml` を作成し、以下の内容を記述します。

```yaml
name: Deploy to Cloudflare Workers
on:
  push:
    branches:
      - main
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm run build
      - name: Deploy to Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

#### B. Wrangler による手動デプロイ
CI/CD を使用せず、ローカルから直接デプロイする場合の手順です。

```bash
pnpm run deploy
```

※内部的には `package.json` で設定した通り `pnpm exec @opennextjs/cloudflare build` と `pnpm exec wrangler deploy` が順番に実行されます。

### 🚩 事前準備（重要）

デプロイ前に **Cloudflare KV** の作成が必要です。これを行わないと `pnpm run deploy` がエラー（code: 10042）で失敗します。

#### 1. Cloudflare KV の作成

ターミナルで以下のコマンドを実行します：

```bash
pnpm exec wrangler kv namespace create "CLOUD_SAVE"
```

実行後、以下のような出力が表示されます：

```text
[[kv_namespaces]]
binding = "CLOUD_SAVE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

この `id` をコピーして、プロジェクト直下の **`wrangler.toml`** の該当箇所を上書きしてください。

#### 2. Google OAuth クライアントの発行

1. [Google Cloud Console](https://console.cloud.google.com/) > **API とサービス** > **認証情報** > **OAuth 2.0 クライアント ID** を作成。
2. 承認済みリダイレクト URI に以下を追加：
   ```
   https://<your-domain>/api/auth/callback/google
   ```

#### 3. シークレットの設定

以下のシークレットを `pnpm exec wrangler secret put <変数名>` コマンド、または Cloudflare ダッシュボードから設定してください。

| 変数名 | 説明 | 生成・取得方法 |
|---|---|---|
| `AUTH_SECRET` | Auth.js 用シークレット | `openssl rand -base64 32` で生成 |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | Google Cloud Console から取得 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | Google Cloud Console から取得 |

---

## 🚀 デプロイ手順

### 1. ビルドとデプロイ

一度 `wrangler.toml` の `id` を更新すれば、以下のコマンドで自動的にビルドとデプロイが行われます：

```bash
pnpm run deploy
```

---

## ❓ トラブルシューティング

### `KV namespace 'YOUR_KV_NAMESPACE_ID' is not valid. [code: 10042]`
`wrangler.toml` の `id` がデフォルトの `"YOUR_KV_NAMESPACE_ID"` のままになっています。「事前準備」の手順に従って KV namespace を作成し、ID を書き換えてください。

### `Auth.js: AUTH_SECRET is missing` (実行時エラー)
`AUTH_SECRET` がシークレットとして設定されていません。`pnpm exec wrangler secret put AUTH_SECRET` を実行して設定してください。


---

## 🛠️ ローカル開発

OpenNext の環境をローカルでシミュレートして動作確認を行う場合は、以下のコマンドを使用します：

```bash
pnpm exec wrangler dev
```

これにより、Cloudflare 実際のランタイムに近い環境（workerd）で Next.js アプリをプレビューできます。
