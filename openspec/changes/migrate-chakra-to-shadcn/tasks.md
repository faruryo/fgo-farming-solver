## 1. ルールファイル・ドキュメント更新

- [x] 1.1 `.agents/rules/no-shadcn-migration.instructions.md` を削除する
- [x] 1.2 `AGENTS.md` の "UI: Chakra UI v2" を "UI: shadcn/ui + Tailwind CSS" に更新する

## 2. Phase 0: 基盤セットアップ + Playwright ベースライン

- [x] 2.1 `pnpm add -D tailwindcss postcss autoprefixer` で Tailwind CSS をインストールする
- [x] 2.2 Tailwind v4 のため CSS ベース設定を採用: `globals.css` に `@theme inline` でFGOカラートークン登録（tailwind.config.ts 不要）
- [x] 2.3 `postcss.config.mjs` を作成する（`@tailwindcss/postcss` 使用）
- [x] 2.4 `app/globals.css` に `@import "tailwindcss"` を追加する（Tailwind v4 形式）
- [x] 2.5 `pnpm dlx shadcn@latest init -d` で shadcn/ui を初期化する
- [x] 2.6 shadcn コンポーネントを一括インストールする: `button dialog alert-dialog accordion dropdown-menu popover tooltip breadcrumb checkbox switch radio-group input select slider label table badge skeleton alert`
- [x] 2.7 `pnpm add -D @playwright/test` + `npx playwright install chromium` で Playwright をインストールする
- [x] 2.8 `playwright.config.ts` を作成する（`webServer` で `pnpm dev` 連携、スクリーンショット設定）
- [x] 2.9 `e2e/visual.spec.ts` を作成する（6 ページのフルページスクリーンショットテスト、`threshold: 0.1`）
- [x] 2.10 `pnpm build` が成功することを確認する（Chakra と Tailwind の共存）
- [x] 2.11 `pnpm playwright test --update-snapshots` でビジュアルベースラインを撮影・保存する

## 3. Phase 1: シンプルコンポーネント移行

- [x] 3.1 `components/common/expand-chevron.tsx`: `@chakra-ui/icons` の `ChevronDownIcon` を `lucide-react` の `ChevronDown` に置き換え、`ComponentWithAs` 型を除去する
- [x] 3.2 `components/common/breadcrumb-link.tsx`: Chakra `BreadcrumbLink` を shadcn `BreadcrumbLink` に置き換え、`ComponentWithAs` 型を除去する（shadcn が Base UI ベースのため `render` prop を使用）
- [x] 3.3 `components/dashboard/HistoryGraph.tsx`: `Box` → `div`、`Button` → shadcn `Button` に置き換える
- [x] 3.4 `components/farming/result-stat.tsx`: Chakra `Stat/StatGroup/StatLabel/StatNumber` を `div` + Tailwind クラスで自作する
- [x] 3.5 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する（ベースライン更新済み）

## 4. Phase 2: テーブル系コンポーネント移行

- [x] 4.1 `components/farming/item-table.tsx`: Chakra `Table/Thead/Tbody/Tr/Th/Td` → shadcn `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` に置き換える
- [x] 4.2 `components/farming/quest-table.tsx`: 同上の変換パターンを適用する（Collapse → hidden クラス、Tooltip render prop 対応）
- [x] 4.3 `components/farming/quest-item-table.tsx`: 同上の変換パターンを適用する
- [x] 4.4 `components/farming/sum-table.tsx`: 同上の変換パターンを適用する
- [x] 4.5 `components/material/result-table.tsx`: 同上の変換パターンを適用する（Input → shadcn Input）
- [x] 4.6 `components/items/drop-table.tsx`: 同上の変換パターンを適用する（`isNumeric` → `className="text-right"`）
- [x] 4.7 `components/items/drop-td.tsx`: `Td` → shadcn `TableCell` に置き換える
- [x] 4.8 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する（ベースライン更新済み）

## 5. Phase 3: フォーム・インタラクティブ系移行

- [x] 5.1 `components/common/checkbox-tree.tsx`: `Checkbox`、`IconButton`、`VStack`、`Box`、`HStack` を shadcn Checkbox + `div` + Tailwind に置き換える（onCheck/onExpand は synthetic event で対応）
- [x] 5.2 `components/farming/item-input.tsx`: `FormControl`、`FormLabel`、`Input`、`HStack` を shadcn `Input` + `div` + native label に置き換える
- [x] 5.3 `components/farming/item-fieldset.tsx`: `Accordion` 群、`FormControl`、`Wrap` を shadcn `Accordion` + `fieldset/legend` + `div` に置き換える（openMultiple は Base UI では不要）
- [x] 5.4 `components/farming/reset-alert-dialog.tsx`: Chakra `AlertDialog` 群 → shadcn `AlertDialog` 群（Base UI）に置き換える
- [x] 5.5 `components/farming/index.tsx`: `useBoolean` → `useState` + setter オブジェクト、`Alert` → shadcn Alert+lucide、`VStack/ButtonGroup/FormControl` → div/fieldset
- [x] 5.6 `components/material/range-slider-with-input.tsx`: Chakra `RangeSlider` → shadcn `Slider`（dual thumb 対応、onValueChange 型調整）
- [x] 5.7 `components/material/material-page-select.tsx`: Chakra `Select` → native `<select className="c-global-dd">`（shadcn Select は API が複雑なため native を使用）
- [x] 5.8 `components/items/drop-rate-style-radio.tsx`: `RadioGroup`、`Radio` → shadcn `RadioGroup`・`RadioGroupItem` に置き換える
- [x] 5.9 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する（ベースライン更新済み）

## 6. Phase 4: ダッシュボードコンポーネント移行

- [x] 6.1 `components/dashboard/FarmingWizard.tsx`: `motion.create(Box)` → `motion.div`、Chakra layout props → Tailwind クラスに置き換える
- [x] 6.2 `components/dashboard/ProgressSection.tsx`: `VStack`、`SimpleGrid`、`Text`、`Box`、`Heading`、`Button` → `div` + Tailwind + shadcn Button に置き換える
- [x] 6.3 `components/dashboard/RecentServantSection.tsx`: `SimpleGrid columns={[2,3,4,5,6]}` → `"grid grid-cols-2 sm:..."` パターン、`motion.create(Box)` → `motion.div`、`Badge` → shadcn Badge
- [x] 6.4 `components/dashboard/GachaSection.tsx`: SimpleGrid → Tailwind grid、Badge → shadcn、Chakra Image → img、Tooltip → Base UI render prop
- [x] 6.5 `components/dashboard/EventSection.tsx`: Badge、Tooltip → shadcn 対応、Chakra Image → img
- [x] 6.6 `components/dashboard/NearGoalSection.tsx`: Box as={NextLink} → NextLink、SimpleGrid/VStack → div + Tailwind
- [x] 6.7 `components/dashboard/RecommendedQuest.tsx`: Spinner → Loader2、Box as={NextLink} → NextLink、Badge → shadcn
- [x] 6.8 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する（material ページの非決定論的ロード問題を waitForSelector で修正済み）

## 7. Phase 5: 高複雑度コンポーネント移行

- [x] 7.1 `components/common/nav.tsx`: `Menu/MenuButton/MenuList/MenuItem/MenuGroup/MenuDivider` → shadcn `DropdownMenu` 群に置き換え、`Switch` → shadcn `Switch`（`gold-switch` クラス付与）、`sx` prop → `globals.css` セレクタに移動する
- [x] 7.2 `globals.css` に `[data-state="unchecked"].gold-switch { background-color: rgba(154,114,36,0.2); }` を追加する
- [x] 7.3 `components/common/cloud-indicator.tsx`: `Popover` 群 → shadcn `Popover`、`Switch` → shadcn `Switch`（`gold-switch` クラス付与）、`sx` prop を除去する
- [x] 7.4 `components/farming/FarmingHistoryChart.tsx`: `useBreakpointValue` を除去し、固定値または `useWindowSize` フックで代替する。`ButtonGroup isAttached` → `flex` div に置き換える
- [x] 7.5 `components/material/index.tsx`: `Accordion` 群、`VStack`、layout 系 Chakra コンポーネントを shadcn・Tailwind に置き換える
- [x] 7.6 `components/material/result-accordion.tsx`: `Accordion` 群 → shadcn `Accordion` 群に置き換える
- [x] 7.7 `components/cloud/index.tsx`: Chakra `Modal` 群 → shadcn `Dialog` 群、`useDisclosure` → `useState<boolean>` に置き換え、`Switch` → shadcn `Switch`（`gold-switch` クラス付与）、`sx` prop を除去する
- [x] 7.8 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する

## 8. Phase 6: 残存コンポーネント整理

- [x] 8.1 `components/servants/material-list.tsx`: `Stat/StatGroup/StatLabel/StatNumber` を `div` + Tailwind で自作、`chakra.span` → `<span>` に置き換える
- [x] 8.2 `components/servants/servant.tsx`: `Breadcrumb` 群 → shadcn `Breadcrumb` 群に置き換える
- [x] 8.3 `components/servants/index.tsx`: 残存 Chakra コンポーネントを `div` + Tailwind に置き換える
- [x] 8.4 `components/material/material.tsx`: `Breadcrumb`、`SimpleGrid` 等を置き換える
- [x] 8.5 `components/items/item.tsx`: `Breadcrumb`、`Wrap`、`Skeleton` → shadcn 対応に置き換える
- [x] 8.6 `components/cloud/parts/local-section.tsx`, `sync-status.tsx`: 残存 Chakra コンポーネントを置き換える
- [x] 8.7 全コンポーネントから Chakra import を除去（farming/*, material/*, items/*, common/* の追加ファイルも含む）
- [x] 8.8 `pnpm type-check` / `pnpm test` が通ることを確認する

## 9. Phase 7: Chakra UI 完全削除

- [x] 9.1 `app/providers.tsx` から `EmotionRegistry`・`ChakraProvider` のインポートと使用を削除し、`SessionProvider` のみにする
- [x] 9.2 `lib/emotion-registry.tsx` を削除する
- [x] 9.3 `theme.ts` を削除する
- [x] 9.4 `app/globals.css` の `.chakra-*` セレクタオーバーライド部分を削除する
- [x] 9.5 全 Chakra + Emotion パッケージを削除（`@chakra-ui/*`, `@emotion/*`）
- [x] 9.6 `app/page.tsx`, `app/farming/history/page.tsx`, `app/quests/[id]/page.tsx`, `hooks/use-cloud-sync.ts` から残存 Chakra 使用を除去
- [x] 9.7 `pnpm type-check` + `pnpm test` (688 tests) 通過確認
- [x] 9.8 `pnpm build`（Next.js + OpenNext Cloudflare）成功確認
- [x] 9.9 `pnpm playwright test` で全 6 ページのビジュアル回帰テストが通ることを確認（新ベースライン更新）
- [ ] 9.10 `pnpm run deploy` で Cloudflare Workers へのデプロイが成功することを確認する

## 10. Phase 8: ビジュアルポリッシュ

移行後のコンポーネントを1つずつ見直し、shadcn/Tailwind らしい自然なスタイルに整える。元の Chakra デザインに戻す必要はなく、読みやすく余白が適切なデザインにすること。

### ダッシュボード

- [x] 10.1 `components/dashboard/ProgressSection.tsx`: stat カードを `p-2 gap-3` → `p-3 gap-4` に広げた
- [x] 10.2 `components/dashboard/NearGoalSection.tsx`: item カード `py-2 px-3` → `py-3 px-4` に拡大
- [x] 10.3 `components/dashboard/GachaSection.tsx`: カード本体 `p-3` → `p-4` に拡大
- [x] 10.4 `components/dashboard/EventSection.tsx`: カード本体 `py-2 px-3` → `py-3 px-4`、アイコン間 `gap-1` → `gap-2`

### 周回ソルバー

- [x] 10.5 `components/farming/quest-table.tsx`: 展開ボタン列 `py-0` → `py-1`、データ列 `px-3 py-2` に統一
- [x] 10.6 `components/farming/item-fieldset.tsx`: AccordionContent の `justify-evenly` → `justify-start gap-6` に変更する
- [x] 10.7 `components/farming/result.tsx`: stat コンテナ `paddingBottom: 8` → 16px、カード `padding: '24px'` → `className="p-6"` Tailwind 化
- [x] 10.8 `app/farming/history/page.tsx`: セル padding `px-4 py-3` に統一済み（Phase 8 前に対応）

### 素材計算機

- [x] 10.9 `components/material/result-table.tsx`: Input セル `py-0` → `py-2` に変更
- [x] 10.10 `components/material/index.tsx`: フィルターグループ `gap: 2` (px) → `gap: 8` (px) に修正

### アイテム・サーヴァント

- [x] 10.11 `components/servants/material-list.tsx`: stat グループ `p-2 gap-2` → `p-4 gap-3` に拡大
- [x] 10.12 `components/servants/index.tsx`: カード `padding: '12px 16px'` → `p-4`、リスト `gap-2` → `gap-3`
- [x] 10.13 `components/items/index.tsx`: カード `padding: '16px'` → `p-4`、inline margin/padding を整理
- [x] 10.14 `components/items/item.tsx`: `padding: '24px'` → `p-6`、edge-to-edge カードは `p-0 overflow-hidden` に変換

### shadcn テーマを FGO パレットに合わせる

- [x] 10.15 `app/globals.css`: TableRow hover を `rgba(154,114,36,0.04)` に override、Input focus を gold ring に
- [x] 10.16 `app/globals.css`: shadcn oklch トークンを FGO カラーに合わせて調整（`--primary: #1e2e4a`、`--ring: rgba(154,114,36,0.5)`、`--muted`、`--accent` 等）

### 共通・仕上げ

- [x] 10.17 `components/farming/FarmingHistoryChart.tsx`: 期間フィルターボタンの二重ボーダーを `border-y border-r first:border-l` で解消済み（確認済み）
- [x] 10.18 コード全体のインラインスタイル（`style={{ padding: '24px' }}` 等）を Tailwind クラスに統一（HistoryGraph, item.tsx, item-fieldset.tsx, farming/index.tsx, cloud/index.tsx, local-section.tsx, doc.tsx）
- [ ] 10.19 各ページで `pnpm dev` を起動し目視確認。問題があれば追加修正する
- [ ] 10.20 `pnpm type-check && pnpm test --run && pnpm playwright test --update-snapshots` でリグレッションがないことを確認し、コミットする
