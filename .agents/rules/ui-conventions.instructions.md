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

## ナビゲーション導線（オーファンページ禁止）

- **BLOCKER**: 新しいルート（`app/**/page.tsx`）を追加したら、URL 直打ち以外の常設導線から必ず到達できるようにすること。トップレベルの一覧/機能ページは原則 `components/common/nav.tsx` のグローバルナビにエントリを追加する。
  - 詳細ページ（`/foo/[id]`）はカード等からの個別導線でよいが、その**一覧/入口ページ自体**は常設ナビから到達可能にすること。ダッシュボード等からの個別直行リンクは一覧導線の代替にはならない（両者は併存させる）。
- **WARNING**: 機能を追加して「動く」ことだけ確認して終わらせない。実機で「ユーザーがその画面にどう辿り着くか」を必ず確認すること（オーファン検出）。
