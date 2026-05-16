## Context

現在のスタイリングスタックは Chakra UI v2（`@chakra-ui/react ^2.10.9`）+ Emotion（`@emotion/react`、`@emotion/styled`、`@emotion/cache`）。コンポーネントは 74 ファイル・約 12,856 行で、Chakra の layout 系（VStack/HStack/Box/SimpleGrid）から複合コンポーネント（Modal/Accordion/Menu/Popover 等）まで幅広く使用している。

Emotion は CSS-in-JS ランタイムであり、Next.js App Router での SSR 時に `useServerInsertedHTML` を利用した `EmotionRegistry` が必要。Cloudflare Workers（OpenNext）環境では動作するが余分な複雑性をもたらしている。

既存の `globals.css` には 20 以上の CSS カスタムプロパティ（`--gold`、`--navy`、`--panel` 等）が定義されており、BEM-like な `.c-*` CSS クラスとともに使われている。この CSS 変数システムは移行後も維持する。

## Goals / Non-Goals

**Goals:**
- Chakra UI v2 と Emotion を完全に削除し、ビルド時スタイル解決（Tailwind CSS）に移行する
- shadcn/ui コンポーネントをプロジェクト内に所有し、長期的なメンテナンス性を確保する
- 移行中のデザイン退行を Playwright ビジュアル回帰テストで自動検出できる体制を作る
- フェーズ単位で独立してデプロイ・検証できる段階的移行を実現する

**Non-Goals:**
- ユーザー向け機能・動作・ビジュアルデザインを変更しない（デザイン刷新は対象外）
- Next.js のバージョンアップや App Router 構造の変更は行わない
- framer-motion の除去は行わない（`motion.div` として継続使用）
- Cloudflare Workers のデプロイ設定（wrangler.toml）は変更しない

## Decisions

### 決定 1: shadcn/ui を選択（Chakra v3 アップグレードより）

**選択**: Chakra v3 への移行ではなく shadcn/ui + Tailwind へ移行する。

**理由**: Chakra v3 は Emotion を廃止しているが、API が大きく変わり移行コストが高い。shadcn/ui はコンポーネントのソースをプロジェクト内に持つため、ライブラリのバージョンロックがなく長期的にメンテしやすい。Tailwind CSS はコミュニティ規模・エコシステムが大きく、AI コーディング支援との相性も良い。

**検討した代替案**:
- Chakra v3: Emotion 除去の恩恵はあるが、`@chakra-ui/v3` へのリネームと大規模 API 破壊的変更で移行コスト高
- Radix UI + CSS Modules: 柔軟だが Tailwind のユーティリティなしではクラス名管理が煩雑

### 決定 2: 段階的移行（フェーズ分割）

**選択**: Chakra UI と Tailwind/shadcn が一時的に共存するフェーズを経て段階的に移行する（7 フェーズ）。

**理由**: Big-bang 移行はコンフリクトリスクが高く、デグレ検出が困難。フェーズ単位で `pnpm build` + ビジュアル回帰テストを実行することで、問題を早期に特定できる。各フェーズは独立してブランチ・PR 化できる。

**フェーズ構成**:
- Phase 0: Tailwind + shadcn/ui セットアップ、Playwright ベースライン撮影
- Phase 1: シンプルコンポーネント（アイコン、パンくず、stat 系）
- Phase 2: テーブル系コンポーネント
- Phase 3: フォーム・インタラクティブ系
- Phase 4: ダッシュボードコンポーネント
- Phase 5: 高複雑度コンポーネント（nav、cloud、material メイン）
- Phase 6: 残存コンポーネント整理
- Phase 7: Chakra/Emotion 完全削除

### 決定 3: 既存 CSS 変数システムを維持する

**選択**: `globals.css` の `:root` CSS 変数（`--gold`、`--navy`、`--panel` 等）をそのまま維持し、`tailwind.config.ts` のカラートークンからも参照する。

**理由**: 既存の BEM-like CSS クラス（`.c-page`、`.c-card` 等）はすでに CSS 変数を参照しており、変更すると影響範囲が広い。Tailwind は `var()` を値に使えるため共存は容易。shadcn/ui の CSS 変数（`--primary`、`--background` 等）と名前空間が異なるため競合しない。

### 決定 4: Playwright を Visual Regression テストに使用

**選択**: `@playwright/test` の `toHaveScreenshot()` でビジュアル回帰テストを行う。

**理由**: ローカル完結、外部サービス不要、ピクセル差分レポートが自動生成される。各フェーズ前後でスクリーンショットを比較することで、デザイン退行を自動検出できる。

### 決定 5: shadcn Switch の `sx` prop 代替

**選択**: Chakra の `sx={{ 'span.chakra-switch__track:not([data-checked])': { bg: '...' } }}` を `globals.css` の `[data-state="unchecked"].gold-switch { background-color: ... }` で代替。

**理由**: shadcn Switch（Radix UI ベース）は `data-state="unchecked"` 属性を使う。CSS クラスで対応することで Emotion に依存しない。影響箇所は 3 ファイル（`nav.tsx`、`cloud/index.tsx`、`cloud-indicator.tsx`）のみ。

### 決定 6: RangeSlider の dual thumb

**選択**: shadcn の Slider は配列 value をサポートするため、まず shadcn Slider で試みる。問題があれば `@radix-ui/react-slider` を直接使用する（shadcn はラッパーなので内部の Radix コンポーネントへのアクセスは容易）。

## Risks / Trade-offs

| リスク | 軽減策 |
|---|---|
| Chakra と Tailwind の CSS 優先度競合 | Phase 0 でビルドを確認し、必要に応じて `!important` または CSS レイヤーを使用 |
| Emotion SSR スタイルと Tailwind の二重ロード（移行中） | 一時的なバンドルサイズ増加は許容。Phase 7 完了で解消 |
| `useBreakpointValue` 除去後の高さ計算 | `FarmingHistoryChart` の固定高さか `useWindowSize` フックで対応 |
| shadcn `Slider` dual thumb が期待通り動作しない | `@radix-ui/react-slider` 直接使用にフォールバック |
| hydration エラー（Radix UI の client-only コンポーネント） | `'use client'` ディレクティブを確認。既存ファイルの多くはすでに付いている |
| framer-motion の `motion.create(Box)` 型エラー | `motion.div` への変更は型安全。影響ファイルは 3 つのみ |

## Migration Plan

1. **Phase 0**: Tailwind + shadcn/ui セットアップ + Playwright ベースライン撮影
2. **Phase 1-6**: フェーズ単位でコンポーネント移行（各フェーズ後に `pnpm build` + `pnpm playwright test` で検証）
3. **Phase 7**: Chakra/Emotion 完全削除、`pnpm build` + `wrangler deploy` でデプロイ確認

**ロールバック**: 各フェーズを独立したブランチ・PR で管理することで、問題発生時はそのフェーズの PR を revert するだけで戻せる。
