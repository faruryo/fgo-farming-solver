---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
applyTo: "app/**/*.tsx,components/**/*.tsx"
---

# Next.js & Chakra UI Conventions

- Use Next.js App Router patterns.
- Use Chakra UI v2 for all UI components.
- Prefer Chakra UI layout components (`Box`, `Flex`, `Stack`, `Grid`) over raw HTML.
- Maintain i18n support by using translation keys in `locales/`.
- Ensure components are responsive.
- Avoid hydration errors by ensuring proper DOM nesting.
