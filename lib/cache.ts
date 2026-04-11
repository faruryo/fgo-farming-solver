import { getHash } from './get-hash'
import { readJson } from './read-json'

const fetchAndWriteJson = async <T>(
  url: string,
  hash: string,
  hashPath: string,
  cachePath: string
) => {
  const fs = await import(/* webpackIgnore: true */ 'fs')
  const path = await import(/* webpackIgnore: true */ 'path')
  console.log(`fetching ${url}`)
  const res = await fetch(url)
  const text = await res.text()
  await fs.default.promises
    .mkdir(path.default.dirname(hashPath), { recursive: true })
    .catch((e: unknown) => console.error(e))
  fs.default.promises.writeFile(hashPath, hash, 'utf-8').catch((e: unknown) => console.error(e))
  fs.default.promises.writeFile(cachePath, text, 'utf-8').catch((e: unknown) => console.error(e))
  return JSON.parse(text) as T
}

export const fetchJsonWithCache = async <T>(url: string) => {
  const isEdge = process.env.NEXT_RUNTIME === 'edge'
  const isCI = process.env.CI === '1'
  const isProd = process.env.NODE_ENV === 'production'

  if (isEdge || (isProd && !isCI)) {
    return fetch(url).then((r) => r.json() as Promise<T>)
  }

  const path = await import(/* webpackIgnore: true */ 'path')
  const cacheDir = path.default.resolve('.next/cache/atlasacademy')
  const stem = path.default.basename(url, '.json')
  const hashPath = path.default.resolve(cacheDir, `${stem}.hash.txt`)
  const cachePath = path.default.resolve(cacheDir, `${stem}.json`)
  const hash = await getHash()

  const fs = await import(/* webpackIgnore: true */ 'fs')
  const obj = fs.default.promises
    .readFile(hashPath, 'utf-8')
    .then((localHash) =>
      localHash == hash
        ? readJson<T>(cachePath)
        : fetchAndWriteJson<T>(url, hash, hashPath, cachePath)
    )
    .catch(async () => fetchAndWriteJson<T>(url, hash, hashPath, cachePath))
  return obj
}
