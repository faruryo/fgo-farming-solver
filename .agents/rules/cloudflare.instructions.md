---
paths:
  - "wrangler.toml"
  - "open-next.config.ts"
  - "updater-worker/**/*"
applyTo: "wrangler.toml,open-next.config.ts,updater-worker/**/*"
---

# Cloudflare Workers & Deployment

- Deploy to Cloudflare Workers using OpenNext.
- Use `nodejs_compat` flag in `wrangler.toml`.
- Build command is two-step: `next build && npx @opennextjs/cloudflare build --skipBuild`.
- Follow the `deployment_guide.md` for any CI/CD or deployment changes.
- Ensure all environment variables are correctly handled for the Workers environment.
