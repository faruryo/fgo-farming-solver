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
