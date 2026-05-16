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

---

### Requirement: QuestIdentity コンポーネント
`components/common/QuestIdentity.tsx` が存在し、クエストの識別情報（スポットアイコン・エリア名・クエスト名・AP）のみを表示する最小単位のコンポーネントとして機能する。スポットアイコンは Atlas Academy の spot 画像 URL を受け取り、未指定時は Swords アイコンにフォールバックする。周回数などのコンテキスト固有情報は含まない。

#### Scenario: スポット画像あり
- **WHEN** `spotIcon` に Atlas Academy の画像 URL を渡す
- **THEN** スポット画像・エリア名・クエスト名・AP が1行で表示される

#### Scenario: スポット画像なし
- **WHEN** `spotIcon` を渡さない
- **THEN** Swords アイコンがフォールバック表示される

---

### Requirement: ItemIdentity コンポーネント
`components/common/ItemIdentity.tsx` が存在し、アイテムの識別情報（アイコン画像）のみを表示する最小単位のコンポーネントとして機能する。アイテム名はアイコンホバー時の Tooltip でのみ表示し、カード内のテキストスペースを節約する。

#### Scenario: アイコン表示と名前 Tooltip
- **WHEN** `icon` と `name` を渡してコンポーネントを表示する
- **THEN** アイコン画像のみが表示され、ホバー時に Tooltip でアイテム名が現れる

---

### Requirement: /api/spot-icon エンドポイント
`GET /api/spot-icon?aaQuestId={n}` が Atlas Academy API を経由してクエストのスポット画像 URL を返す。`nice/JP/quest/{id}/1` で warId・spotId を取得し、`nice/JP/war/{warId}` でスポット画像 URL を解決する。warId 単位・aaQuestId 単位でメモリキャッシュを持つ。

#### Scenario: 正常解決
- **WHEN** 有効な `aaQuestId` でリクエストする
- **THEN** `{ imageUrl: "https://static.atlasacademy.io/..." }` が返る

#### Scenario: 未解決・エラー
- **WHEN** 無効な `aaQuestId` またはタイムアウトが発生する
- **THEN** `{ imageUrl: null }` が返る

---

### Requirement: ダッシュボードカードのコンポーネント統一
`NearGoalSection`（達成間近の素材）と `RecommendedQuest`（周回予定クエスト）の両セクションが QuestIdentity・ItemIdentity を共通部品として使用する。両カードで「あとN周で達成！」が右端に配置され、ランク番号（1–4）とセクションタイトルに Info Tooltip が表示される。

#### Scenario: 達成間近の素材カード
- **WHEN** ダッシュボードに表示される
- **THEN** ItemIdentity（アイテムアイコン）→ QuestIdentity（クエスト情報）→ カウントダウン（右端）の順で1行に配置される

#### Scenario: 周回予定クエストカード
- **WHEN** ダッシュボードに表示される
- **THEN** QuestIdentity（クエスト情報）→ ドロップアイコン → 「あとN周で達成！」（右端）の順で配置される

---

### Requirement: ServantStars 共通コンポーネント
`components/common/ServantStars.tsx` が存在し、サーヴァントのレアリティを SVG 5角星で表示する共通コンポーネントとして機能する。`rarity` prop（number）を受け取り、その数だけ星を並べる。星は右に行くほど上に重なる（右の星が前面）。rarity が 0 の場合は何も表示しない（空レンダリング）。

#### Scenario: rarity 5 のサーヴァントを表示する
- **WHEN** rarity が 5 のサーヴァント詳細ページを開く
- **THEN** STARS ブロックに SVG 5角星が5個、右の星が左の星に重なって表示される

#### Scenario: rarity 1 のサーヴァントを表示する
- **WHEN** rarity が 1 のサーヴァントの詳細ページを開く
- **THEN** STARS ブロックに SVG 5角星が1個表示される

#### Scenario: rarity 0 のサーヴァントを表示する
- **WHEN** rarity が 0 のサーヴァント詳細ページを開く
- **THEN** STARS ブロックは空欄（星なし）になり、レイアウトが崩れない

---

### Requirement: 星表示の統一
サーヴァントのレアリティを表示する全箇所（サーヴァント詳細・一覧・マテリアルカード・ダッシュボード）が ServantStars コンポーネントを使用する。各ページ独自の星表示実装（文字列 repeat、span 配列）は存在しない。

#### Scenario: 全ページで同一コンポーネントを使用
- **WHEN** サーヴァント詳細・一覧・マテリアル・ダッシュボードページを開く
- **THEN** いずれのページでも星が同じ SVG スタイル（グラデーション・縁線・重なり）で表示される

---

### Requirement: サーヴァント詳細ページの STARS/CLASS 段差修正
サーヴァント詳細ページ右上の STARS ブロックと CLASS ブロックのラベルが同じ高さに揃う。

#### Scenario: STARS と CLASS のラベル位置
- **WHEN** サーヴァント詳細ページを開く
- **THEN** "STARS" ラベルと "CLASS" ラベルが同じ底辺ラインに並ぶ
