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

- [ ] 4.1 `components/farming/item-table.tsx`: Chakra `Table/Thead/Tbody/Tr/Th/Td` → shadcn `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` に置き換える
- [ ] 4.2 `components/farming/quest-table.tsx`: 同上の変換パターンを適用する
- [ ] 4.3 `components/farming/quest-item-table.tsx`: 同上の変換パターンを適用する
- [ ] 4.4 `components/farming/sum-table.tsx`: 同上の変換パターンを適用する
- [ ] 4.5 `components/material/result-table.tsx`: 同上の変換パターンを適用する
- [ ] 4.6 `components/items/drop-table.tsx`: 同上の変換パターンを適用する（`isNumeric` → `className="text-right"`）
- [ ] 4.7 `components/items/drop-td.tsx`: `Td` → shadcn `TableCell` に置き換える
- [ ] 4.8 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する

## 5. Phase 3: フォーム・インタラクティブ系移行

- [ ] 5.1 `components/common/checkbox-tree.tsx`: `Checkbox`、`IconButton`、`VStack`、`Box`、`HStack` を shadcn Checkbox + `div` + Tailwind に置き換える
- [ ] 5.2 `components/farming/item-input.tsx`: `FormControl`、`FormLabel`、`Input`、`HStack` を shadcn `Input`・`Label` + `div` に置き換える
- [ ] 5.3 `components/farming/item-fieldset.tsx`: `Accordion` 群、`FormControl`、`Wrap` を shadcn `Accordion` + `div` に置き換える
- [ ] 5.4 `components/farming/reset-alert-dialog.tsx`: Chakra `AlertDialog` 群 → shadcn `AlertDialog` 群に置き換える
- [ ] 5.5 `components/farming/index.tsx`: Chakra `Alert`、`ButtonGroup`、`FormControl`、`FormLabel` を shadcn 等に置き換え、`useBoolean` を `useState<boolean>` に置き換える
- [ ] 5.6 `components/material/range-slider-with-input.tsx`: Chakra `RangeSlider` → shadcn `Slider`（dual thumb）に置き換える。動作確認後、問題があれば `@radix-ui/react-slider` 直接使用に切り替える
- [ ] 5.7 `components/material/material-page-select.tsx`: Chakra `Select` → shadcn `Select` に置き換える
- [ ] 5.8 `components/items/drop-rate-style-radio.tsx`: `RadioGroup`、`Radio` → shadcn `RadioGroup`・`RadioGroupItem` に置き換える
- [ ] 5.9 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する

## 6. Phase 4: ダッシュボードコンポーネント移行

- [ ] 6.1 `components/dashboard/FarmingWizard.tsx`: `motion.create(Box)` → `motion.div`、Chakra layout props → Tailwind クラスに置き換える
- [ ] 6.2 `components/dashboard/ProgressSection.tsx`: `VStack`、`SimpleGrid`、`Text`、`Box`、`Heading`、`Button` → `div` + Tailwind + shadcn Button に置き換える
- [ ] 6.3 `components/dashboard/RecentServantSection.tsx`: `SimpleGrid columns={[2,3,4,5,6]}` → `"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"`、`motion.create(Box)` → `motion.div`、`Badge` → shadcn Badge に置き換える
- [ ] 6.4 `components/dashboard/GachaSection.tsx`: `SimpleGrid columns={[1,1,2,3]}` → `"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"`、`Badge` → shadcn Badge、Chakra `Image` → Next.js `Image` に置き換える
- [ ] 6.5 `components/dashboard/EventSection.tsx`: `Badge`、`Tooltip`、`Skeleton` → shadcn 対応に置き換える
- [ ] 6.6 `components/dashboard/NearGoalSection.tsx`: `SimpleGrid`、`Tooltip` → Tailwind + shadcn Tooltip に置き換える
- [ ] 6.7 `components/dashboard/RecommendedQuest.tsx`: `Badge`、`SimpleGrid` → shadcn + Tailwind に置き換える
- [ ] 6.8 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する

## 7. Phase 5: 高複雑度コンポーネント移行

- [ ] 7.1 `components/common/nav.tsx`: `Menu/MenuButton/MenuList/MenuItem/MenuGroup/MenuDivider` → shadcn `DropdownMenu` 群に置き換え、`Switch` → shadcn `Switch`（`gold-switch` クラス付与）、`sx` prop → `globals.css` セレクタに移動する
- [ ] 7.2 `globals.css` に `[data-state="unchecked"].gold-switch { background-color: rgba(154,114,36,0.2); }` を追加する
- [ ] 7.3 `components/common/cloud-indicator.tsx`: `Popover` 群 → shadcn `Popover`、`Switch` → shadcn `Switch`（`gold-switch` クラス付与）、`sx` prop を除去する
- [ ] 7.4 `components/farming/FarmingHistoryChart.tsx`: `useBreakpointValue` を除去し、固定値または `useWindowSize` フックで代替する。`ButtonGroup isAttached` → `flex` div に置き換える
- [ ] 7.5 `components/material/index.tsx`: `Accordion` 群、`VStack`、layout 系 Chakra コンポーネントを shadcn・Tailwind に置き換える
- [ ] 7.6 `components/material/result-accordion.tsx`: `Accordion` 群 → shadcn `Accordion` 群に置き換える
- [ ] 7.7 `components/cloud/index.tsx`: Chakra `Modal` 群 → shadcn `Dialog` 群、`useDisclosure` → `useState<boolean>` に置き換え、`Switch` → shadcn `Switch`（`gold-switch` クラス付与）、`sx` prop を除去する
- [ ] 7.8 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する

## 8. Phase 6: 残存コンポーネント整理

- [ ] 8.1 `components/servants/material-list.tsx`: `Stat/StatGroup/StatLabel/StatNumber` を `div` + Tailwind で自作、`chakra.span` → `<span>` に置き換える
- [ ] 8.2 `components/servants/servant.tsx`: `Breadcrumb` 群 → shadcn `Breadcrumb` 群に置き換える
- [ ] 8.3 `components/servants/index.tsx`: 残存 Chakra コンポーネントを `div` + Tailwind に置き換える
- [ ] 8.4 `components/material/material.tsx`: `Breadcrumb`、`SimpleGrid` 等を置き換える
- [ ] 8.5 `components/items/item.tsx`: `Breadcrumb`、`Wrap`、`Skeleton` → shadcn 対応に置き換える
- [ ] 8.6 `components/cloud/parts/local-section.tsx`, `sync-status.tsx`: 残存 Chakra コンポーネントを置き換える
- [ ] 8.7 `pnpm playwright test` でビジュアル回帰テストを実行し、差分がないことを確認する

## 9. Phase 7: Chakra UI 完全削除

- [ ] 9.1 `app/providers.tsx` から `EmotionRegistry`・`ChakraProvider` のインポートと使用を削除し、`SessionProvider` のみにする
- [ ] 9.2 `lib/emotion-registry.tsx` を削除する
- [ ] 9.3 `theme.ts` を削除する
- [ ] 9.4 `app/globals.css` の `.chakra-*` セレクタオーバーライド部分を削除する
- [ ] 9.5 `pnpm remove @chakra-ui/react @chakra-ui/accordion @chakra-ui/breadcrumb @chakra-ui/button @chakra-ui/checkbox @chakra-ui/form-control @chakra-ui/hooks @chakra-ui/icons @chakra-ui/input @chakra-ui/layout @chakra-ui/menu @chakra-ui/next-js @chakra-ui/system @chakra-ui/table @chakra-ui/utils @emotion/react @emotion/styled @emotion/cache` で全パッケージを削除する
- [ ] 9.6 `pnpm type-check` で型エラーがないことを確認する
- [ ] 9.7 `pnpm lint` で ESLint エラーがないことを確認する
- [ ] 9.8 `pnpm build` が成功することを確認する
- [ ] 9.9 `pnpm playwright test` で全ページのビジュアル回帰テストが通ることを確認する
- [ ] 9.10 `pnpm run deploy` で Cloudflare Workers へのデプロイが成功することを確認する
