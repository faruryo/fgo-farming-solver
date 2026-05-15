# FGO Farming Solver - Shared Agent Context

## Absolute Rules
- Do not hardcode credentials (API keys, passwords).
- Do not apply test data to production.
- Use `pnpm`, not `npm` or `yarn`.
- Do not add unverified dependencies.
- Follow the existing project structure (App Router).

## Stack Overview
- **Core**: Next.js App Router
- **Runtime**: Cloudflare Workers (OpenNext)
- **UI**: shadcn/ui + Tailwind CSS
- **Data**: lib/ & data/

## Key Commands
- `pnpm dev` — local dev server
- `pnpm run build` — Next.js build + OpenNext Cloudflare build
- `pnpm run deploy` — build + `wrangler deploy` to Cloudflare Workers
- `pnpm run lint` — ESLint
- `pnpm run type-check` — tsc --noEmit
- `pnpm run format` — Prettier

## Global Gotchas
- Build is two-step: `next build && npx @opennextjs/cloudflare build --skipBuild`
- `wrangler.toml` uses `nodejs_compat` and `global_fetch_strictly_public`.
- Refer to domain-specific rules for implementation details.

## OpenSpec Workflow
All implementation work MUST be done through OpenSpec to keep specs in sync with code.

- **Large changes** (new features, refactors): use `openspec new change <name>` → see `/opsx-propose` skill for details.
- **Small changes** (bug fixes, tweaks): edit `openspec/specs/<capability>/spec.md` directly, then run `openspec validate --specs`.
