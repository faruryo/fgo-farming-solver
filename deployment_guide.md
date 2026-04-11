# FGO Solver Edge 移行・デプロイガイド

このドキュメントでは、FGO Farming Solver を Cloudflare Pages (Edge ランタイム) へ移行するためのステータスと、最終的なデプロイ手順をまとめています。

## 🚀 推奨：Cloudflare Pages でのセットアップ手順

Next.js アプリを Cloudflare で運用する場合、**Pages** プロジェクトとして作成するのが最も標準的で確実です。

### 1. プロジェクトの新規作成
1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/)にログインします。
2. **[Workers & Pages]** > **[作成]** > **[Pages]** > **[Git に接続]** を選択します。
3. 対象のリポジトリ (`fgo-farming-solver`) を選択します。

### 2. ビルド設定
ビルド設定（Build settings）のステップで、以下の値を入力します：
- **フレームワーク プリセット**: `Next.js`
- **ビルド コマンド**: `npx @cloudflare/next-on-pages`
- **ビルド出力ディレクトリ**: `.vercel/output`

### 3. 関数（Functions）の互換性設定（重要）
プロジェクトが作成されたら（最初のビルドが失敗してもOK）、プロジェクトの管理画面へ移動します：
1. **[設定]** > **[Functions]** > **[互換性フラグ]** を開きます。
2. **「本番環境」**と**「プレビュー環境」**の両方のフラグに `nodejs_compat` を追加して保存します。
   - *注意: これがないと AWS SDK や Auth.js が正常に動作しません。*

### 4. 環境変数の設定
**[設定]** > **[環境変数]** で、以下の変数を追加します：
- `AUTH_SECRET`: 適当な32文字のランダムな文字列（Auth.js v5 の暗号化に必要）。
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`: Twitter API の認証情報。
- `MY_AWS_ACCESS_KEY_ID` / `MY_AWS_SECRET_ACCESS_KEY`: DynamoDB 用の AWS 認証情報。
- `NEXT_PUBLIC_BASE_URL`: デプロイ後の URL（例: `https://fgo-farming-solver.pages.dev`）。

---

## 🛠️ 現在の Workers 設定のまま修正する場合

Workers 側の CI/CD 設定（Workers Builds）を使い続けたい場合は、以下の修正を行ってください：

1. 対象 Worker の **[設定]** > **[ビルド]** を開きます。
2. **ビルド コマンド**: `npx @cloudflare/next-on-pages`
3. **デプロイ コマンド**: `npx wrangler pages deploy .vercel/output --project-name fgo-farming-solver`

> [!WARNING]
> Workers の画面から Pages をデプロイする設定は、Cloudflare の標準的な構成ではありません。環境変数の反映などでトラブルが起きやすいため、上記 **[推奨：Pages]** の手順でプロジェクトを作り直すことを強くおすすめします。

---

## ✅ 完了済みの修正内容
- **Auth.js の移行**: `next-auth@beta` (v5) にアップグレードし、Edge ランタイムでのセッション管理に対応させました。
- **Edge API へのリライト**: `pages/api/cloud/index.ts` を Web 標準の Request/Response API を使うように修正し、`Buffer` 依存を解消しました。
- **競合の解消**: 新しい App Router 形式の認証ハンドラーと競合していた古い Pages Router 側のファイルを削除しました。
- **Wrangler 設定の準備**: 互換性フラグなどを管理するための `wrangler.toml` を作成しました。
