/**
 * master-data / rarity 更新パイプラインのローカル CPU 計測ハーネス。
 *
 * 歴史的経緯: もとは Cloudflare cron worker(fgo-data-updater / fgo-rarity-updater)
 * の CPU を無料プラン上限(公称 10ms / subrequest 50)に対して数値化するために作られた。
 * 2026-06-11 に更新処理は GitHub Actions(scripts/run-updater.ts /
 * run-rarity-updater.ts)へ移管され CPU 制約は消えたが、フェーズ別の CPU/subrequest
 * 内訳の回帰観測用としてそのまま使える(Atlas への負荷感の把握にも有用)。
 *
 * 計測方針:
 *   - CPU 時間は `process.cpuUsage()` で測る。fetch / KV 待ち(I/O)は CPU に
 *     計上されない。
 *   - fetch はディスクキャッシュ化(scripts/.cache-bench/)。2回目以降は
 *     ネットワークを排して `.json()` の parse コスト(= CPU の主因)だけを
 *     安定計測できる。`--refresh` で再取得。
 *   - subrequest 数 = fetch 呼び出し回数(キャッシュヒットでも本番では実 fetch
 *     なのでカウントする)。
 *   - ピーク RSS を 25ms 間隔でサンプリング。
 *
 * フェーズは run-updater.ts / run-rarity-updater.ts と同じ4分割:
 *   A. updateDrops          (fetchAndTransformData)
 *   B. updateDashboardMeta  (fetchDashboardMeta)
 *   C. updateRarityApTables (buildRarityApTables ← LP ソルバ)
 *   D. updateServantsList   (basic_servant fetch + filter)
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
import { fetchAndTransformData, fetchDashboardMeta, fetchActiveEvents } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'
import { waveCountSeedFrom } from '../lib/master-data/wave-count'

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
// rarity 計算は別ジョブ(run-rarity-updater.ts)に分離済み。どのジョブに属す
// フェーズかを記録して per-job で集計する(型名は歴史的経緯で WorkerName のまま)。
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

// mocks/all.json を前回ペイロードとして読む(本番ジョブの KV read 相当)。
// waveCount seed と短縮ID安定化レジストリの両方をここから導出する。
function readPreviousFromMock(): MasterData | undefined {
  try {
    const p = path.resolve(process.cwd(), 'mocks', 'all.json')
    return JSON.parse(readFileSync(p, 'utf8')) as MasterData
  } catch {
    return undefined
  }
}

// run-updater.ts / run-rarity-updater.ts の各フェーズと同じ処理を再現
const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'
const RARITY_AP_TABLES_KEY = 'rarity_ap_tables'
const SERVANTS_LIST_KEY = 'servants_list'

async function main() {
  console.log(`\n=== master-data update CPU bench (${REFRESH ? 'network refresh' : 'cached'}) ===\n`)

  // ── updater ジョブ (run-updater.ts): A/B/D ──
  // 0. アクティブイベントを1回だけ取得 (run-updater.ts と同じく共有)
  const events = await measure('0. prefetch active events (shared)', 'updater', async () => {
    return await fetchActiveEvents()
  })

  // 既存 mocks/all.json を前回ペイロードとして読み、本番 KV キャッシュ時の
  // 定常 subrequest 数と短縮IDのピン留めを再現する(初回 cold 時は --refresh で無効化はしない)。
  const previous = readPreviousFromMock()
  const waveCountSeed = waveCountSeedFrom(previous)

  // A. updateDrops
  const drops = await measure('A. updateDrops (fetchAndTransformData)', 'updater', async () => {
    const d = await fetchAndTransformData({ events, waveCountSeed, previous })
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

  // ── rarity ジョブ (run-rarity-updater.ts): C のみ・独立 run ──
  // 本番では all_drops_json を KV から読んで buildRarityApTables(drops) を呼ぶ。
  await measure('C. rarity job (buildRarityApTables / LP solver)', 'rarity', async () => {
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

  // 2026-06-11 に worker → GitHub Actions 移管済みのため Workers の上限制約は
  // 消えたが、ジョブ別の内訳は回帰観測用に残す。
  const subBy = (w: WorkerName) =>
    results.filter((r) => r.worker === w).reduce((a, r) => a + r.subrequests, 0)
  const cpuBy = (w: WorkerName) =>
    results.filter((r) => r.worker === w).reduce((a, r) => a + r.cpuMs, 0)

  console.log('\n--- ジョブ別 subrequest / CPU ---')
  console.log(`  updater (run-updater.ts)        : subreq ${subBy('updater')},  CPU ${cpuBy('updater').toFixed(0)}ms`)
  console.log(`  rarity  (run-rarity-updater.ts) : subreq ${subBy('rarity')},  CPU ${cpuBy('rarity').toFixed(0)}ms`)
  console.log(`  (参考) 合算: subreq ${totalSub}, CPU ${totalCpu.toFixed(0)}ms`)
}

main().catch((e) => {
  clearInterval(sampler)
  console.error(e)
  process.exit(1)
})
