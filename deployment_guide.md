# FGO Solver OpenNext 移行・デプロイガイド

このドキュメントでは、FGO Farming Solver を最新の **Cloudflare Workers (with Static Assets)** 環境へ OpenNext を使用してデプロイするための手順をまとめています。従来の Pages から、より制御性の高い Workers ベースのデプロイ方式へ移行しました。

## 🚀 推奨：Cloudflare Workers でのデプロイ手順

Cloudflare の最新の推奨（Workers Assets）に基づき、OpenNext を使用して Workers としてデプロイします。

### 1. ビルドとデプロイ

ターミナルで以下のコマンドを実行するだけで、ビルドとデプロイが一括で行われます：

```bash
npm run deploy
```

内部的には以下の処理が行われます：
1. `next build`: Next.js の標準ビルド。
2. `npx @opennextjs/cloudflare build`: OpenNext による Cloudflare Worker 形式への変換。
3. `wrangler deploy`: Workers Assets を含むプロジェクトのデプロイ。

### 2. 環境変数の設定

Workers としてデプロイするため、[Cloudflare ダッシュボード](https://dash.cloudflare.com/) の **[Workers & Pages]** > **(プロジェクト名)** > **[設定]** > **[変数とシークレット]** で以下の変数を追加してください：

- `AUTH_SECRET`: Auth.js v5 用のシークレット文字列。
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`: Twitter API 認証情報。
- `MY_AWS_ACCESS_KEY_ID` / `MY_AWS_SECRET_ACCESS_KEY`: DynamoDB 用の AWS 認証情報。
- `NEXT_PUBLIC_BASE_URL`: 本番環境の URL。

> [!IMPORTANT]
> すでに Pages プロジェクトとして運用している場合は、Workers プロジェクトとして新しく認識されるため、環境変数を再設定する必要があります。

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
