---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
applyTo: "app/**/*.tsx,components/**/*.tsx"
---

# UI Conventions (Next.js + shadcn/ui + Tailwind CSS)

- Use Next.js App Router patterns.
- Use **shadcn/ui + Tailwind CSS** for all UI components. Components live in `@/components/ui/`.
- Prefer `div` + Tailwind utility classes for layout (no external layout libraries).
- Maintain i18n support by using translation keys in `locales/`.
- Ensure components are responsive using Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`).
- Avoid hydration errors by ensuring proper DOM nesting.

## UI動作確認（ブラウザ実機検証を毎回行う）

- **BLOCKER**: `app/**` `components/**` の UI を変更したら、type-check / テストだけで完了とせず、**毎回ブラウザ実機で動作確認すること**（ユーザーから都度依頼されなくても必須）。`browser-use`（Chrome DevTools 相当の自動操作）で `http://localhost:3000` の該当画面を開き、変更点の挙動・連動・永続・i18n 表示を確認する。
- **検証の型**（最低限）:
  1. `browser-use open http://localhost:3000/<対象パス>` → `browser-use state` で要素確認
  2. 入力を変えて連動値を `browser-use eval` で取得し、期待値と一致するか確認
  3. localStorage 永続が絡む変更はリロード後の保持も確認
  4. ツールチップ/ホバー UI は `browser-use hover` で実表示を確認
  5. 必要なら `browser-use screenshot --full` を撮ってユーザーに共有
- **dev server はユーザー管理**: Claude は `pnpm dev` を起動・再起動しない。`curl` でポート（既定 3000）疎通を確認し、落ちていれば「`! pnpm dev` で起動して」と促してから検証する。
- **WARNING**: 検証で値がズレた・描画されない場合は「動いたつもり」で完了報告しない。原因を直してから再検証する。

## ナビゲーション導線（オーファンページ禁止）

- **BLOCKER**: 新しいルート（`app/**/page.tsx`）を追加したら、URL 直打ち以外の常設導線から必ず到達できるようにすること。トップレベルの一覧/機能ページは原則 `components/common/nav.tsx` のグローバルナビにエントリを追加する。
  - 詳細ページ（`/foo/[id]`）はカード等からの個別導線でよいが、その**一覧/入口ページ自体**は常設ナビから到達可能にすること。ダッシュボード等からの個別直行リンクは一覧導線の代替にはならない（両者は併存させる）。
- **WARNING**: 機能を追加して「動く」ことだけ確認して終わらせない。実機で「ユーザーがその画面にどう辿り着くか」を必ず確認すること（オーファン検出）。
