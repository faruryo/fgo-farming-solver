/**
 * fgo-data-updater (updater-worker) ローカル CPU 計測ハーネス。
 *
 * 目的:
 *   Cloudflare Workers の `scheduled()` が cron 1回で消費する **CPU 時間** を
 *   ローカルで再現可能に観測する。無料プランの上限(CPU 10ms / subrequest 50)
 *   に対して、現状どのフェーズがどれだけ食っているかを数値化する。
 *
 * 計測方針:
 *   - CPU 時間は `process.cpuUsage()` で測る。fetch / KV 待ち(I/O)は CPU に
 *     計上されない ── これは Cloudflare の CPU 計測と同じ定義。
 *   - fetch はディスクキャッシュ化(scripts/.cache-bench/)。2回目以降は
 *     ネットワークを排して `.json()` の parse コスト(= CPU の主因)だけを
 *     安定計測できる。`--refresh` で再取得。
 *   - subrequest 数 = fetch 呼び出し回数(キャッシュヒットでも本番では実 fetch
 *     なのでカウントする)。
 *   - ピーク RSS を 25ms 間隔でサンプリング。
 *
 * フェーズは updater-worker/index.ts の scheduled() と同じ4分割:
 *   A. updateDrops          (fetchAndTransformData)
 *   B. updateDashboardMeta  (fetchDashboardMeta)
 *   C. updateRarityApTables (buildRarityApTables ← LP ソルバ)
 *   D. updateServantsList   (basic_servant fetch + filter)
 *
 * 注: 本番は B/C/D を Promise.all で並行実行するが、JS は単一スレッドなので
 *     CPU 時間の合計は逐次実行と同じ。ここでは内訳を取るため逐次で測る。
 *
 * 実行: pnpm bench:updater  [--refresh]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import { origin, region } from '../constants/atlasacademy'
import { buildRarityApTables } from '../lib/progress/rarity-ap-table'
import { fetchAndTransformData, fetchDashboardMeta, fetchNiceEvents } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'

const REFRESH = process.argv.includes('--refresh')
const CACHE_DIR = path.resolve(process.cwd(), 'scripts', '.cache-bench')

// ── fetch のキャッシュ＆計測ラッパ ───────────────────────────────────
let fetchCount = 0
const realFetch = globalThis.fetch

const cachePath = (url: string) => {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16)
  return path.join(CACHE_DIR, `${hash}.bin`)
}

globalThis.fetch = (async (input: any, init?: any) => {
  fetchCount++
  const url = typeof input === 'string' ? input : input?.url ?? String(input)
  const file = cachePath(url)
  if (!REFRESH && existsSync(file)) {
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

// ── in-memory KV モック ───────────────────────────────────────────
const kv = new Map<string, string>()
const putSizes: Record<string, number> = {}
const MASTER_DATA = {
  get: async (k: string) => kv.get(k) ?? null,
  put: async (k: string, v: string) => {
    kv.set(k, v)
    putSizes[k] = v.length
  },
}

// ── ピーク RSS サンプラ ────────────────────────────────────────────
let peakRss = 0
const sampler = setInterval(() => {
  const rss = process.memoryUsage().rss
  if (rss > peakRss) peakRss = rss
}, 25)

// ── フェーズ計測 ───────────────────────────────────────────────────
// rarity 計算は別 worker (rarity-worker) に分離済み。subrequest は worker ごとに
// 別予算なので、どの worker に属すフェーズかを記録して per-worker で集計する。
type WorkerName = 'updater' | 'rarity'
type PhaseResult = {
  name: string
  worker: WorkerName
  cpuMs: number
  wallMs: number
  subrequests: number
}
const results: PhaseResult[] = []

async function measure<T>(name: string, worker: WorkerName, fn: () => Promise<T>): Promise<T> {
  const fc0 = fetchCount
  const cpu0 = process.cpuUsage()
  const w0 = performance.now()
  const out = await fn()
  const wallMs = performance.now() - w0
  const cpu = process.cpuUsage(cpu0)
  const cpuMs = (cpu.user + cpu.system) / 1000
  results.push({ name, worker, cpuMs, wallMs, subrequests: fetchCount - fc0 })
  return out
}

// mocks/all.json から aaQuestId→waveCount の seed を作る(worker の KV seed 相当)
function readWaveCountSeedFromMock(): Map<number, number> | undefined {
  try {
    const p = path.resolve(process.cwd(), 'mocks', 'all.json')
    const raw = JSON.parse(readFileSync(p, 'utf8')) as {
      quests?: Array<{ aaQuestId?: number; waveCount?: number }>
    }
    const seed = new Map<number, number>()
    for (const q of raw.quests ?? []) {
      if (typeof q.aaQuestId === 'number' && typeof q.waveCount === 'number') {
        seed.set(q.aaQuestId, q.waveCount)
      }
    }
    return seed.size > 0 ? seed : undefined
  } catch {
    return undefined
  }
}

// updater-worker/index.ts の各フェーズと同じ処理を再現
const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'
const RARITY_AP_TABLES_KEY = 'rarity_ap_tables'
const SERVANTS_LIST_KEY = 'servants_list'

async function main() {
  console.log(`\n=== fgo-data-updater CPU bench (${REFRESH ? 'network refresh' : 'cached'}) ===\n`)

  // ── updater worker (fgo-data-updater): A/B/D ──
  // 0. nice_event.json を1回だけ取得 (worker scheduled() と同じく共有)
  const events = await measure('0. prefetch nice_event.json (shared)', 'updater', async () => {
    return await fetchNiceEvents()
  })

  // 既存 mocks/all.json の waveCount を seed にして、本番 KV キャッシュ時の
  // 定常 subrequest 数を再現する(初回 cold 時は --refresh で seed 無効化はしない)。
  const waveCountSeed = readWaveCountSeedFromMock()

  // A. updateDrops
  const drops = await measure('A. updateDrops (fetchAndTransformData)', 'updater', async () => {
    const d = await fetchAndTransformData({ events, waveCountSeed })
    const v = validateMasterData(d)
    if (v.ok) await MASTER_DATA.put(MASTER_DATA_KEY, JSON.stringify(d))
    else console.warn(`  (degraded payload: ${v.reason})`)
    return d as MasterData
  })

  // B. updateDashboardMeta
  await measure('B. updateDashboardMeta (fetchDashboardMeta)', 'updater', async () => {
    const meta = await fetchDashboardMeta(drops?.quests, { events })
    const v = validateDashboardMeta(meta)
    if (v.ok) await MASTER_DATA.put(DASHBOARD_META_KEY, JSON.stringify(meta))
  })

  // ── rarity worker (fgo-rarity-updater): C のみ・独立 invocation ──
  // 本番では all_drops_json を KV から読んで buildRarityApTables(drops) を呼ぶ。
  await measure('C. rarity worker (buildRarityApTables / LP solver)', 'rarity', async () => {
    const raw = await MASTER_DATA.get(MASTER_DATA_KEY)
    const d = raw ? (JSON.parse(raw) as MasterData) : drops
    const tables = await buildRarityApTables(d || undefined)
    await MASTER_DATA.put(RARITY_AP_TABLES_KEY, JSON.stringify(tables))
  })

  // D. updateServantsList
  await measure('D. updateServantsList (basic_servant fetch)', 'updater', async () => {
    const res = await fetch(`${origin}/export/${region}/basic_servant.json`)
    const all = (await res.json()) as Array<{
      id: number
      name: string
      rarity: number
      type: string
      collectionNo: number
    }>
    const filtered = all
      .filter((s) => (s.type === 'normal' || s.type === 'heroine') && s.collectionNo > 0)
      .map((s) => ({ id: s.id, name: s.name, rarity: s.rarity }))
    await MASTER_DATA.put(SERVANTS_LIST_KEY, JSON.stringify(filtered))
  })

  clearInterval(sampler)
  report()
}

function report() {
  const totalCpu = results.reduce((a, r) => a + r.cpuMs, 0)
  const totalWall = results.reduce((a, r) => a + r.wallMs, 0)
  const totalSub = results.reduce((a, r) => a + r.subrequests, 0)

  const pad = (s: string, n: number) => s.padEnd(n)
  const num = (n: number, w = 9) => n.toFixed(1).padStart(w)

  console.log(pad('Phase', 52) + 'CPU(ms)'.padStart(10) + 'Wall(ms)'.padStart(11) + 'Subreq'.padStart(9))
  console.log('-'.repeat(82))
  for (const r of results) {
    console.log(pad(r.name, 52) + num(r.cpuMs) + num(r.wallMs, 11) + String(r.subrequests).padStart(9))
  }
  console.log('-'.repeat(82))
  console.log(pad('TOTAL', 52) + num(totalCpu) + num(totalWall, 11) + String(totalSub).padStart(9))

  console.log('\n--- KV payload sizes ---')
  for (const [k, v] of Object.entries(putSizes)) {
    console.log(`  ${k}: ${(v / 1024).toFixed(1)} KB`)
  }

  console.log('\n--- Peak memory (プロセス全体・参考値) ---')
  console.log(`  peak RSS: ${(peakRss / 1024 / 1024).toFixed(1)} MB`)

  // 実態(observability + CI ログで確認): アカウントは Workers 無料プラン。
  //   - [limits](cpu_ms / subrequests)は設定不可(無料プランでは deploy が拒否)。
  //   - subrequest は 1 invocation あたりの上限が厳しい ← これが律速。
  //   - rarity 計算 (C) は per-servant 取得を含むため別 worker に分離し、独立した
  //     subrequest 予算を確保している。
  const subBy = (w: WorkerName) =>
    results.filter((r) => r.worker === w).reduce((a, r) => a + r.subrequests, 0)
  const cpuBy = (w: WorkerName) =>
    results.filter((r) => r.worker === w).reduce((a, r) => a + r.cpuMs, 0)

  console.log('\n--- worker 別 subrequest / CPU (各 worker は独立 invocation = 独立予算) ---')
  console.log(`  updater (fgo-data-updater)  : subreq ${subBy('updater')},  CPU ${cpuBy('updater').toFixed(0)}ms`)
  console.log(`  rarity  (fgo-rarity-updater): subreq ${subBy('rarity')},  CPU ${cpuBy('rarity').toFixed(0)}ms`)
  console.log(`  (参考) 合算: subreq ${totalSub}, CPU ${totalCpu.toFixed(0)}ms`)
  console.log(
    '\n  注: 無料プランは subrequest が律速。worker ごとに上限内へ収めること。\n' +
    '      ローカルはメモリ潤沢で GC 暴走を再現しないため、CPU は参考値。\n'
  )
}

main().catch((e) => {
  clearInterval(sampler)
  console.error(e)
  process.exit(1)
})
