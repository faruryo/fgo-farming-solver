## ADDED Requirements

### Requirement: Tailwind CSS ビルド設定
プロジェクトは Tailwind CSS をビルド時スタイル解決として使用する。`tailwind.config.ts` と `postcss.config.mjs` が存在し、`app/globals.css` に `@tailwind base/components/utilities` ディレクティブが含まれること。Tailwind のカラートークンは既存の CSS カスタムプロパティ（`--gold`、`--navy`、`--panel` 等）を参照すること。

#### Scenario: ビルド成功
- **WHEN** `pnpm build` を実行する
- **THEN** Tailwind CSS が正常にコンパイルされ、ビルドが成功する

#### Scenario: CSS 変数トークン参照
- **WHEN** コンポーネントで `text-fgo-gold` 等の Tailwind カラークラスを使用する
- **THEN** `var(--gold)` を値として参照し、正しい色が適用される

---

### Requirement: shadcn/ui コンポーネントライブラリ
`components/ui/` ディレクトリに shadcn/ui コンポーネント群が配置される。コンポーネントはプロジェクト内のソースコードとして所有され、外部ライブラリのバージョンに依存しない。以下のコンポーネントが含まれること: Button、Dialog、AlertDialog、Accordion、DropdownMenu、Popover、Tooltip、Breadcrumb、Checkbox、Switch、RadioGroup、Input、Select、Slider、Label、Table 群、Badge、Skeleton、Alert。

#### Scenario: コンポーネントのインポート
- **WHEN** `components/ui/button` 等からコンポーネントをインポートする
- **THEN** TypeScript 型エラーなしに使用でき、Tailwind クラスでスタイルが適用される

#### Scenario: Dialog の開閉
- **WHEN** Dialog トリガーをクリックする
- **THEN** Dialog が開き、閉じるボタンまたはオーバーレイクリックで閉じる

---

### Requirement: Chakra UI および Emotion の完全除去
`@chakra-ui/*` および `@emotion/*` パッケージは `package.json` から削除される。`app/providers.tsx` は `SessionProvider` のみを含み、`EmotionRegistry` および `ChakraProvider` を含まない。`lib/emotion-registry.tsx` および `theme.ts` は削除される。

#### Scenario: Chakra パッケージが存在しない
- **WHEN** `package.json` を確認する
- **THEN** `@chakra-ui/` および `@emotion/` で始まるパッケージが存在しない

#### Scenario: Chakra コンポーネントのインポートがない
- **WHEN** プロジェクト全体を `grep` で検索する
- **THEN** `from '@chakra-ui/'` のインポートが 0 件である

---

### Requirement: Switch コンポーネントのカスタムスタイル
shadcn Switch（Radix UI ベース）の未チェック状態のトラック色を、`globals.css` の CSS セレクタでカスタマイズできる。`data-state="unchecked"` 属性と CSS クラスを組み合わせて色を指定する。

#### Scenario: Switch 未チェック状態のゴールドカラー
- **WHEN** `gold-switch` クラスを付与した Switch が未チェック状態にある
- **THEN** トラック背景色が `rgba(154, 114, 36, 0.2)` で表示される

---

### Requirement: Playwright ビジュアル回帰テスト
`e2e/visual.spec.ts` が存在し、主要 6 ページ（`/`、`/farming`、`/material`、`/items`、`/servants`、`/cloud`）のフルページスクリーンショットを取得してベースラインと比較できる。`playwright.config.ts` が存在し、開発サーバーとの連携が設定されている。

#### Scenario: ベースライン撮影
- **WHEN** `pnpm playwright test --update-snapshots` を実行する
- **THEN** 各ページのスクリーンショットが `e2e/__snapshots__/` に保存される

#### Scenario: ビジュアル差分検出
- **WHEN** コンポーネントのスタイルが変化した後に `pnpm playwright test` を実行する
- **THEN** 変化したページのテストが失敗し、差分画像が生成される

#### Scenario: 許容誤差内の差異を無視
- **WHEN** フォントアンチエイリアス等による 0.1% 以下のピクセル差異がある
- **THEN** テストが成功する（`threshold: 0.1` を適用）
