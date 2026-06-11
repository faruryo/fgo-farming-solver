/**
 * fgo-data-updater の定常状態(nice_war 304 経路)の CPU 内訳を計測する一時スクリプト。
 * - fetch はディスクキャッシュ(bench-updater と同じ .cache-bench)を流用
 * - nice_war.json への条件付き GET は 304 を返すよう偽装し、KV キャッシュ
 *   (/tmp/nwaa.json = 本番 KV の実物)から aaQuests を再利用させる
 * - previous は /tmp/adj.json(本番 KV の all_drops_json 実物)
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { fetchAndTransformData, fetchDashboardMeta, fetchActiveEvents } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { waveCountSeedFrom } from '../lib/master-data/wave-count'

const CACHE_DIR = path.resolve(process.cwd(), 'scripts', '.cache-bench')
const cachePath = (url: string) => {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16)
  return path.join(CACHE_DIR, `${hash}.bin`)
}

let fetchCount = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  fetchCount++
  const url = typeof input === 'string' ? input : (input?.url ?? String(input))
  if (url.includes('nice_war.json')) {
    // 304 経路の偽装(本番の大半の run と同じ)
    return new Response(null, { status: 304 })
  }
  const file = cachePath(url)
  if (existsSync(file)) {
    const buf = await readFile(file)
    return new Response(buf, { status: 200 })
  }
  const res = await realFetch(input, init)
  const buf = Buffer.from(await res.arrayBuffer())
  if (res.ok) {
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(file, buf)
  }
  return new Response(buf, { status: res.status })
}) as typeof fetch

const niceWarCacheRaw = readFileSync('/tmp/nwaa.json', 'utf8')
const previousRaw = readFileSync('/tmp/adj.json', 'utf8')

const phases: Array<{ name: string; cpuMs: number; subreq: number }> = []
async function measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const fc0 = fetchCount
  const t0 = process.cpuUsage()
  const out = await fn()
  const t = process.cpuUsage(t0)
  phases.push({ name, cpuMs: (t.user + t.system) / 1000, subreq: fetchCount - fc0 })
  return out
}

async function main() {
  const events = await measure('0. fetchActiveEvents', () => fetchActiveEvents())
  const previous = await measure('1. KV previous parse (all_drops_json)', () =>
    JSON.parse(previousRaw) as MasterData
  )
  const niceWarCache = {
    get: async () => JSON.parse(niceWarCacheRaw),
    put: async () => {},
  }
  const drops = await measure('A. fetchAndTransformData (304 steady state)', () =>
    fetchAndTransformData({
      events,
      waveCountSeed: waveCountSeedFrom(previous),
      waveCountMaxFetch: 20,
      niceWarCache,
      previous,
    })
  )
  await measure('A2. JSON.stringify + (KV put)', () => JSON.stringify(drops))
  await measure('B. fetchDashboardMeta', () => fetchDashboardMeta(drops.quests, { events }))
  await measure('D. servants_list (basic_servant 再parse)', async () => {
    const res = await fetch('https://api.atlasacademy.io/export/JP/basic_servant.json')
    const all = (await res.json()) as Array<{ id: number; name: string; rarity: number; type: string; collectionNo: number }>
    return all.filter(s => (s.type === 'normal' || s.type === 'heroine') && s.collectionNo > 0).map(s => ({ id: s.id, name: s.name, rarity: s.rarity }))
  })

  console.log('\n--- steady-state (304) CPU breakdown ---')
  let total = 0
  for (const p of phases) {
    total += p.cpuMs
    console.log(`${p.name.padEnd(48)} ${p.cpuMs.toFixed(1).padStart(8)} ms  subreq ${p.subreq}`)
  }
  console.log(`${'TOTAL'.padEnd(48)} ${total.toFixed(1).padStart(8)} ms  subreq ${fetchCount}`)
}

main().catch(e => { console.error(e); process.exit(1) })
