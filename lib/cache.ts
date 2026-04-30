import { getHash } from './get-hash'
import { readJson } from './read-json'
import { canAccessFs } from './data-source'

const fetchAndWriteJson = async <T>(
  url: string,
  hash: string,
  hashPath: string,
  cachePath: string
) => {
  const fsModule = await import(/* webpackIgnore: true */ 'fs')
  const fs = fsModule.default?.promises || fsModule.promises || fsModule
  const pathModule = await import(/* webpackIgnore: true */ 'path')
  const path = pathModule.default || pathModule
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
  const hasFs = await canAccessFs()
  const isBrowser = typeof window !== 'undefined'

  // In edge/cloudflare/browser/prod — just fetch directly
  if (isBrowser || !hasFs) {
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
  const pathModule = await import(/* webpackIgnore: true */ 'path')
  const path = pathModule.default || pathModule
  const cacheDir = path.resolve('.next/cache/atlasacademy')
  const stem = path.basename(url, '.json')
  const hashPath = path.resolve(cacheDir, `${stem}.hash.txt`)
  const cachePath = path.resolve(cacheDir, `${stem}.json`)

  const fsModule = await import(/* webpackIgnore: true */ 'fs')
  const fs = fsModule.default?.promises || fsModule.promises || fsModule

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
