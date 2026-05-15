---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
applyTo: "app/**/*.tsx,components/**/*.tsx"
---

# Next.js & shadcn/ui Conventions

- Use Next.js App Router patterns.
- Use **shadcn/ui + Tailwind CSS** for all new UI components (migration from Chakra UI v2 in progress).
- Prefer `div` + Tailwind utility classes for layout over Chakra layout components (`Box`, `Flex`, `Stack`).
- Use shadcn/ui components from `@/components/ui/` for interactive elements (Button, Dialog, Checkbox, etc.).
- Maintain i18n support by using translation keys in `locales/`.
- Ensure components are responsive using Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`).
- Avoid hydration errors by ensuring proper DOM nesting.
- Do NOT add new Chakra UI component imports; use shadcn/ui or Tailwind instead.
