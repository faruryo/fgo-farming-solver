/**
 * Unified data source abstraction.
 *
 * All server-side data fetching follows one pattern:
 *   1. Try Cloudflare KV  (works in production, silently fails in dev)
 *   2. Try local mock file (works in dev, silently fails in production/edge)
 *
 * Each step is wrapped in try/catch so callers never need to check
 * isDev / isEdge themselves.
 */

import type { CloudflareEnv } from '../types/cloudflare-env.d'

// ── KV ──────────────────────────────────────────────────────────────

/**
 * Read a string value from Cloudflare KV.
 * Returns `null` when KV is unavailable (local dev) or the key is missing.
 */
export async function kvGet(key: string): Promise<string | null> {
  try {
    // 1. Try to get context from process.env (common in many Cloudflare Worker environments)
    const processEnv = (process.env as unknown as CloudflareEnv)
    if (processEnv && processEnv.MASTER_DATA && typeof processEnv.MASTER_DATA.get === 'function') {
      return await processEnv.MASTER_DATA.get(key)
    }

    // 2. Try to get context from @opennextjs/cloudflare
    // We use a dynamic import to avoid bundling issues in local development
    try {
      // Use dynamic import directly. Most modern bundlers handle this fine.
      const { getCloudflareContext } = await import("@opennextjs/cloudflare")
      const context = await getCloudflareContext()
      const env = (context.env || context) as CloudflareEnv
      
      if (env && env.MASTER_DATA) {
        return await env.MASTER_DATA.get(key)
      }
    } catch {
      // Dynamic import or getCloudflareContext might fail in some environments (e.g. local dev)
      // but that's okay, we'll return null and fall back to local files
    }

    return null
  } catch (e) {
    console.error('KV Access Error:', e)
    return null
  }
}

/**
 * Read a JSON value from Cloudflare KV, parsed as `T`.
 */
export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key)
  if (raw === null) return null
  return JSON.parse(raw) as T
}

// ── Local file ──────────────────────────────────────────────────────

/**
 * Read a JSON file relative to project root.
 * Returns `null` when the file doesn't exist or fs APIs are unavailable
 * (true edge runtime).
 */
export async function readLocalJson<T>(relativePath: string): Promise<T | null> {
  try {
    const pathMod = await new Function('return import("path")')()
    const fsMod  = await new Function('return import("fs/promises")')()
    const fs   = fsMod.default || fsMod
    const abs  = pathMod.default.resolve(process.cwd(), relativePath)
    const text = await fs.readFile(abs, 'utf-8')
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// ── Combined fetcher ────────────────────────────────────────────────

/**
 * Try KV first, then fall back to a local mock file.
 *
 * Usage:
 *   const data = await fetchData<MyType>('kv_key', 'mocks/my-data.json')
 */
export async function fetchData<T>(
  kvKey: string,
  mockPath: string
): Promise<T | null> {
  // 1. KV (production)
  const fromKv = await kvGetJson<T>(kvKey)
  if (fromKv !== null) return fromKv

  // 2. Local file (development)
  return readLocalJson<T>(mockPath)
}

// ── File-system helpers (dev only, fail silently in edge) ───────────

/**
 * Check whether Node.js file-system APIs are available.
 * Probes with readFile rather than just importing the module, because
 * Cloudflare Workers with nodejs_compat allows the import to succeed
 * (via unenv shims) but throws "[unenv] not implemented" on actual calls.
 */
export async function canAccessFs(): Promise<boolean> {
  if (typeof window !== 'undefined') return false
  try {
    // Use a trick to hide the import from Turbopack/Webpack static analysis
    // while still working in Node.js/Vitest.
    const fsMod = await new Function('r', `
      if (typeof r === 'function') {
        try {
          var fs = r("fs");
          return fs.promises || fs;
        } catch (e) {}
      }
      try {
        return import("fs/promises");
      } catch (e) {
        return null;
      }
    `)(typeof require !== 'undefined' ? require : undefined)
    if (!fsMod) return false
    
    const fs = (fsMod.default ?? fsMod) as { readFile: (p: string, e: string) => Promise<string> }
    // Probing a non-existent path to see if it throws ENOENT (real fs) or something else (unenv)
    await fs.readFile('/__canAccessFs__', 'utf-8')
    return true
  } catch (e: unknown) {
    // Real Node.js fs throws ENOENT for a missing file — fs IS available.
    // unenv stubs throw "[unenv] … not implemented" with no code — fs is NOT available.
    return e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT'
  }
}
