# FGO Solver OpenNext 移行・デプロイガイド

このドキュメントでは、FGO Farming Solver を最新の **Cloudflare Workers (with Static Assets)** 環境へ OpenNext を使用してデプロイするための手順をまとめています。従来の Pages から、より制御性の高い Workers ベースのデプロイ方式へ移行しました。

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

### 3. 環境変数の設定

Workers としてデプロイするため、[Cloudflare ダッシュボード](https://dash.cloudflare.com/) の **[Workers & Pages]** > **(プロジェクト名)** > **[設定]** > **[変数とシークレット]** で以下の変数を追加してください：

- `AUTH_SECRET`: Auth.js v5 用のシークレット文字列。
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`: Twitter API 認証情報。
- `MY_AWS_ACCESS_KEY_ID` / `MY_AWS_SECRET_ACCESS_KEY`: DynamoDB 用の AWS 認証情報。
- `NEXT_PUBLIC_BASE_URL`: 本番環境の URL。

> [!IMPORTANT]
> すでに Pages プロジェクトとして運用している場合は、Workers プロジェクトとして新しく認識されるため、環境変数を再設定する必要があります。

### 4. 推奨される Wrangler 設定 (Best Practices)

公式ガイドに基づき、`wrangler.toml` に以下の設定を追加してあります：

- **Compatibility Flags**: `nodejs_compat` に加え、外部への fetch を安定させる `global_fetch_strictly_public` を有効化。
- **Service Bindings**: 自己参照用の `WORKER_SELF_REFERENCE` を設定（Next.js の特定の機能で必要になる場合があります）。

---

## 🛠️ ローカル開発

OpenNext の環境をローカルでシミュレートして動作確認を行う場合は、以下のコマンドを使用します：

```bash
npx wrangler dev
```

これにより、Cloudflare 実際のランタイムに近い環境（workerd）で Next.js アプリをプレビューできます。

---

## ✅ 移行完了済みの内容

- **OpenNext への移行**: 非推奨の `@cloudflare/next-on-pages` から最新の `@opennextjs/cloudflare` へ移行しました。
- **Workers Assets への対応**: `wrangler.toml` を更新し、静的ファイルを Workers 側でホストする新方式に変更しました。
- **Edge Runtime 設定の削除**: OpenNext での互換性を高めるため、各ページの `export const runtime = "edge"` を削除し、Node.js 規格のライブラリ（AWS SDK等）が使いやすい構成にしました。
- **ビルドエラーの回避**: ビルド時に外部 API (AtlasAcademy 等) や AWS 認証が必要なページにおいて、`export const dynamic = 'force-dynamic'` を設定することで、ビルド時の Prerender エラーを解消しました。
- **依存関係の整理**: `package.json` の `overrides` を用いて、Cloudflare 環境で問題を起こしやすかった `esbuild` や `yaml` のバージョン競合を解決しました。
