## Why

Chakra UI v2 は Emotion（CSS-in-JS ランタイム）に依存しており、Cloudflare Workers 環境でのSSR において EmotionRegistry が必要なため複雑性が高く、ランタイムコストも存在する。shadcn/ui + Tailwind CSS への移行によりスタイルをビルド時に解決し、ランタイム依存を排除するとともに、コンポーネントのソースコードをプロジェクト内に直接所有することで長期メンテナンス性を向上させる。

## What Changes

- Chakra UI v2（`@chakra-ui/react` 他 14 サブパッケージ）を削除
- `@emotion/react`、`@emotion/styled`、`@emotion/cache` を削除
- Tailwind CSS を導入（`tailwindcss`、`postcss`、`autoprefixer`）
- shadcn/ui コンポーネント群を `components/ui/` に導入
- `theme.ts`（Chakra `extendTheme`）を `tailwind.config.ts` + CSS 変数へ移植し削除
- `lib/emotion-registry.tsx` を削除
- `app/providers.tsx` から `EmotionRegistry`・`ChakraProvider` を除去
- 全コンポーネント（74 ファイル）の Chakra UI コンポーネントを shadcn/ui または Tailwind ユーティリティクラスへ置換
- `app/globals.css` の `.chakra-*` セレクタオーバーライドを削除
- `.agents/rules/no-shadcn-migration.instructions.md` を削除
- `AGENTS.md` の UI フレームワーク記載を更新
- Playwright ビジュアル回帰テストを導入（移行前後のデザイン一致を保証）

ユーザー向け機能・動作は変わらない（純粋な実装移行）。

## Capabilities

### New Capabilities

- `ui-framework`: shadcn/ui + Tailwind CSS の設定・コンポーネント・テーマシステム（Tailwind config、CSS 変数マッピング、`components/ui/` 配下のコンポーネント群）

### Modified Capabilities

<!-- なし — 機能要件（spec レベルの振る舞い）は変更しない。既存 specs はすべて実装詳細に依存しないため、今回の移行では更新不要。 -->

## Impact

- **削除パッケージ**: `@chakra-ui/react` 他 14 パッケージ + `@emotion/*` 3 パッケージ（合計約 18 パッケージ）
- **追加パッケージ**: `tailwindcss`、`postcss`、`autoprefixer`、`@playwright/test`、shadcn/ui（Radix UI ベース、コンポーネントはソースコードとして追加）
- **影響ファイル数**: コンポーネント 74 ファイル（全ページ・全コンポーネント）
- **ビルドシステム**: `postcss.config.mjs` 追加が必要
- **Cloudflare Workers**: Emotion ランタイム除去により互換性が向上
- **framer-motion**: 継続使用（`motion.create(Box)` → `motion.div` へ変更）
- **既存 CSS 変数**: `globals.css` の `:root` 変数（`--gold`、`--navy` 等）はそのまま維持し Tailwind config からも参照する
