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
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = (await getCloudflareContext({ async: true })) as unknown as {
      env: CloudflareEnv
    }
    return await env.MASTER_DATA.get(key)
  } catch {
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
    const pathMod = await import(/* webpackIgnore: true */ 'path')
    const fsMod  = await import(/* webpackIgnore: true */ 'fs/promises')
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
 */
export async function canAccessFs(): Promise<boolean> {
  try {
    await import(/* webpackIgnore: true */ 'fs/promises')
    return true
  } catch {
    return false
  }
}
