import { getHash } from './get-hash'
import { readJson } from './read-json'

const fetchAndWriteJson = async <T>(
  url: string,
  hash: string,
  hashPath: string,
  cachePath: string
) => {
  const fsMod = await new Function('r', `
    if (typeof r === 'function') {
      try {
        var fs = r("fs");
        return fs.promises || fs;
      } catch (e) {}
    }
    try {
      return import("fs");
    } catch (e) {
      return null;
    }
  `)(typeof require !== 'undefined' ? require : undefined)
  const fs = fsMod?.default?.promises || fsMod?.promises || fsMod

  const pathMod = await new Function('r', `
    if (typeof r === 'function') {
      try {
        return r("path");
      } catch (e) {}
    }
    try {
      return import("path");
    } catch (e) {
      return null;
    }
  `)(typeof require !== 'undefined' ? require : undefined)
  const path = pathMod?.default || pathMod
  console.log(`fetching ${url}`)
  const res = await fetch(url)
  const text = await res.text()
  await fs
    .mkdir(path.dirname(hashPath), { recursive: true })
    .catch((e: unknown) => console.error(e))
  fs.writeFile(hashPath, hash, 'utf-8').catch((e: unknown) => console.error(e))
  fs.writeFile(cachePath, text, 'utf-8').catch((e: unknown) => console.error(e))
  return JSON.parse(text) as T
}
export const fetchJsonWithCache = async <T>(url: string) => {
  const isBrowser = typeof window !== 'undefined'

  // In browser — just fetch directly without checking filesystem
  if (isBrowser) {
    return fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch failed with status ${r.status}`)
        return r.json<T>()
      })
      .catch((e) => {
        console.error(`Fetch failed for ${url}:`, e)
        throw e
      })
  }

  const { canAccessFs } = await import('./data-source')
  const hasFs = await canAccessFs()

  // In edge/cloudflare/prod (no fs) — just fetch directly
  if (!hasFs) {
    return fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch failed with status ${r.status}`)
        return r.json<T>()
      })
      .catch((e) => {
        console.error(`Fetch failed for ${url}:`, e)
        throw e
      })
  }

  // Dev with filesystem access — use disk cache
  const pathMod = await new Function('r', `
    if (typeof r === 'function') {
      try {
        return r("path");
      } catch (e) {}
    }
    try {
      return import("path");
    } catch (e) {
      return null;
    }
  `)(typeof require !== 'undefined' ? require : undefined)
  const path = pathMod?.default || pathMod
  const cacheDir = path.resolve('.next/cache/atlasacademy')
  const stem = path.basename(url, '.json')
  const hashPath = path.resolve(cacheDir, `${stem}.hash.txt`)
  const cachePath = path.resolve(cacheDir, `${stem}.json`)

  const fsMod = await new Function('r', `
    if (typeof r === 'function') {
      try {
        var fs = r("fs");
        return fs.promises || fs;
      } catch (e) {}
    }
    try {
      return import("fs");
    } catch (e) {
      return null;
    }
  `)(typeof require !== 'undefined' ? require : undefined)
  const fs = fsMod?.default?.promises || fsMod?.promises || fsMod

  const [hash, localHash] = await Promise.all([
    getHash().catch(() => null),
    fs.readFile(hashPath, 'utf-8').catch(() => null),
  ])

  if (hash !== null && localHash === hash) {
    return readJson<T>(cachePath).catch(() =>
      fetchAndWriteJson<T>(url, hash, hashPath, cachePath)
    )
  }

  return fetchAndWriteJson<T>(url, hash ?? '', hashPath, cachePath).catch(async (e: unknown) => {
    const stale = await readJson<T>(cachePath).catch(() => null)
    if (stale !== null) {
      console.warn(`Network unavailable for ${url}, using stale cache`)
      return stale
    }
    console.error(`fetchJsonWithCache for ${url} failed:`, e)
    throw e
  })
}
