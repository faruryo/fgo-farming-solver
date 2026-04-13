# FGO Farming Solver

## Stack
- Next.js App Router (`output: 'standalone'`)
- Deployed to **Cloudflare Workers** via OpenNext (`@opennextjs/cloudflare`)
- Package manager: **pnpm** (migrated from npm — use pnpm, not npm/npx)
- UI: Chakra UI v2
- i18n supported (see `locales/`)

## Key Commands
- `pnpm dev` — local dev server
- `pnpm run build` — Next.js build + OpenNext Cloudflare build
- `pnpm run deploy` — build + `wrangler deploy` to Cloudflare Workers
- `pnpm run lint` — ESLint
- `pnpm run type-check` — tsc --noEmit
- `pnpm run format` — Prettier

## Deploy
- Target: Cloudflare Workers (NOT Vercel, NOT Cloudflare Pages)
- Build output: `.open-next/` directory
- Config: `wrangler.toml` + `open-next.config.ts`
- See `deployment_guide.md` for CI/CD setup details

## Gotchas
- Build command is two-step: `next build && npx @opennextjs/cloudflare build --skipBuild`
- `wrangler.toml` uses `nodejs_compat` and `global_fetch_strictly_public` flags
- Data fetched from external sources (servants, items) — see `lib/` and `data/`
