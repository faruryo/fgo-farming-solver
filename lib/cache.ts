import { getHash } from './get-hash'
import { readJson } from './read-json'

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
  const isEdge = process.env.NEXT_RUNTIME === 'edge'
  const isCloudflare = process.env.CF_PAGES === '1' || process.env.OPEN_NEXT === '1'
  const isDev = process.env.NODE_ENV === 'development'

  if (isEdge || isCloudflare || !isDev) {
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

  const pathModule = await import(/* webpackIgnore: true */ 'path')
  const path = pathModule.default || pathModule
  const cacheDir = path.resolve('.next/cache/atlasacademy')
  const stem = path.basename(url, '.json')
  const hashPath = path.resolve(cacheDir, `${stem}.hash.txt`)
  const cachePath = path.resolve(cacheDir, `${stem}.json`)
  const hash = await getHash()

  const fsModule = await import(/* webpackIgnore: true */ 'fs')
  const fs = fsModule.default?.promises || fsModule.promises || fsModule
  const obj = fs
    .readFile(hashPath, 'utf-8')
    .then((localHash: string) =>
      localHash == hash
        ? readJson<T>(cachePath)
        : fetchAndWriteJson<T>(url, hash, hashPath, cachePath)
    )
    .catch(async (e: unknown) => {
      console.warn(`Cache read failed or entry missing for ${url}, fetching fresh...`, e)
      return fetchAndWriteJson<T>(url, hash, hashPath, cachePath)
    })
    .catch((e: unknown) => {
      console.error(`fetchJsonWithCache for ${url} failed completely:`, e)
      throw e
    })
  return obj
}
