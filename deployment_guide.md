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

### 3. クラウドセーブのセットアップ

クラウドセーブ機能は **Google OAuth 認証** + **Cloudflare KV** で実装されています。

#### A. Cloudflare KV の作成

```bash
npx wrangler kv namespace create "CLOUD_SAVE"
```

出力された `id` を `wrangler.toml` の該当箇所に記入してください：

```toml
[[kv_namespaces]]
binding = "CLOUD_SAVE"
id = "ここに出力されたIDを貼り付ける"
```

#### B. Google OAuth クライアントの発行

1. [Google Cloud Console](https://console.cloud.google.com/) > **API とサービス** > **認証情報** > **OAuth 2.0 クライアント ID** を作成。
2. 承認済みリダイレクト URI に以下を追加：
   ```
   https://<your-domain>/api/auth/callback/google
   ```

#### C. シークレットの設定

`npx wrangler secret put` またはダッシュボードの **[Workers & Pages]** > **(プロジェクト名)** > **[設定]** > **[変数とシークレット]** で設定します。

| 変数名 | 説明 | コマンド例 |
|---|---|---|
| `AUTH_SECRET` | Auth.js v5 用シークレット | `openssl rand -base64 32 \| npx wrangler secret put AUTH_SECRET` |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | `npx wrangler secret put GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | `npx wrangler secret put GOOGLE_CLIENT_SECRET` |

### 5. 推奨される Wrangler 設定 (Best Practices)

公式ガイドに基づき、`wrangler.toml` に以下の設定を追加してあります：

- **Compatibility Flags**: `nodejs_compat` に加え、外部への fetch を安定させる `global_fetch_strictly_public` を有効化。
- **Service Bindings**: 自己参照用の `WORKER_SELF_REFERENCE` を設定（Next.js の特定の機能で必要になる場合があります）。
- **KV Bindings**: クラウドセーブ用に `CLOUD_SAVE` KV namespace を設定。

---

## 🛠️ ローカル開発

OpenNext の環境をローカルでシミュレートして動作確認を行う場合は、以下のコマンドを使用します：

```bash
npx wrangler dev
```

これにより、Cloudflare 実際のランタイムに近い環境（workerd）で Next.js アプリをプレビューできます。
