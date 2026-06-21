/**
 * 開催中＋直近終了のロト（ボックス）型イベントデータを Atlas Academy から取得し、
 * コンパクト化して KV 投入用ファイル (`event_data_json`) に書き出す。
 *
 * 背景: Cloudflare Workers 無料プランは CPU 10ms 超で kill されるため、
 * 重い fetch は GH Actions 側で行い、Worker は KV を読むだけにする
 * (`refresh-nice-war.yml` / `lib/master-data/update.ts` の方針を踏襲)。
 *
 * 実行: pnpm exec tsx scripts/refresh-event-data.ts [出力パス]
 *   出力: EventData 型の JSON（既定 ./event_data.json）。
 *   後続の `wrangler kv key put event_data_json --path <出力パス>` で KV へ投入する
 *   (.github/workflows/refresh-event-data.yml 参照)。
 *
 * 対象イベント:
 *   - Atlas `basic_event.json` から type='eventQuest' のイベントを取得。
 *   - 開催中 (now < endedAt) または終了後 30 日以内を対象。
 *   - `nice_event/{eventId}` の lotteries[] が空のものはロト型でないためスキップ。
 *
 * バリデーション思想（lib/master-data/validation.ts の DRY_RUN 思想を踏襲）:
 *   - スキーマ不整合のイベントはスキップ（他イベントへの影響なし）。
 *   - 最低 1 件のイベントが抽出できなければ書き出し拒否してエラー終了。
 *   - 既存 KV は本スクリプト外でのみ操作する（wrangler kv key put は GH Actions 側）。
 */
import { writeFileSync } from 'node:fs'

import { origin, region } from '../constants/atlasacademy'
import type {
  EventCurrency,
  EventData,
  EventFarmingNode,
  EventLotteryBox,
  EventPlannerEvent,
  EventShopItem,
} from '../lib/master-data/types'

// ── 設定 ─────────────────────────────────────────────────────────────

/** 終了後何日以内のイベントを対象にするか */
const ENDED_GRACE_DAYS = 30

// ── Atlas 生データ型（最小限のフィールドのみ定義） ────────────────────

interface BasicEvent {
  id: number
  type: string
  name: string
  startedAt: number
  endedAt: number
}

interface AtlasGift {
  objectId: number
  num: number
  type?: string
}

interface AtlasBox {
  boxIndex: number
  maxNum: number
  isRare: boolean
  gifts: AtlasGift[]
}

interface AtlasLottery {
  cost: {
    item: { id: number; name: string; icon?: string }
    amount: number
  }
  /** false のとき最終箱が無限ループ（廃課金勢は箱種類数を超えて回せる）。 */
  limited?: boolean
  boxes: AtlasBox[]
}

interface AtlasShopItem {
  purchaseType: string
  payType: string
  targetIds: number[]
  setNum: number
  limitNum: number
  cost: {
    item: { id: number }
    amount: number
  }
  gifts?: unknown[]
}

interface AtlasQuest {
  id: number
  name: string
  type: string
  afterClear: string
  consume: number
  phases: number[]
}

interface AtlasSpot {
  quests: AtlasQuest[]
}

interface AtlasWar {
  spots: AtlasSpot[]
}

interface AtlasDrop {
  objectId: number
  num: number
  runs: number
  dropCount: number
}

interface AtlasQuestDetail {
  id: number
  name: string
  consume: number
  drops?: AtlasDrop[]
}

interface AtlasEvent {
  id: number
  name: string
  type: string
  startedAt: number
  endedAt: number
  warIds: number[]
  lotteries: AtlasLottery[]
  shop: AtlasShopItem[]
}

// ── バリデーション ─────────────────────────────────────────────────────

/**
 * AtlasEvent の最低限の形状チェック。
 * 失敗した場合は reason 文字列を返し、呼び出し側がこのイベントをスキップする。
 */
function validateAtlasEvent(raw: unknown): { ok: true; data: AtlasEvent } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'not an object' }
  }
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'number') return { ok: false, reason: 'missing id' }
  if (typeof r.name !== 'string') return { ok: false, reason: 'missing name' }
  if (typeof r.type !== 'string') return { ok: false, reason: 'missing type' }
  if (typeof r.startedAt !== 'number') return { ok: false, reason: 'missing startedAt' }
  if (typeof r.endedAt !== 'number') return { ok: false, reason: 'missing endedAt' }
  if (!Array.isArray(r.lotteries)) return { ok: false, reason: 'missing lotteries array' }
  if (!Array.isArray(r.shop)) return { ok: false, reason: 'missing shop array' }
  if (!Array.isArray(r.warIds)) return { ok: false, reason: 'missing warIds array' }
  return { ok: true, data: raw as AtlasEvent }
}

/**
 * AtlasLottery の形状チェック。
 */
function validateLottery(raw: unknown, idx: number): { ok: true; data: AtlasLottery } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: `lottery[${idx}] not an object` }
  }
  const r = raw as Record<string, unknown>
  if (typeof r.cost !== 'object' || r.cost === null) {
    return { ok: false, reason: `lottery[${idx}].cost missing` }
  }
  const cost = r.cost as Record<string, unknown>
  if (typeof cost.item !== 'object' || cost.item === null) {
    return { ok: false, reason: `lottery[${idx}].cost.item missing` }
  }
  const item = cost.item as Record<string, unknown>
  if (typeof item.id !== 'number') return { ok: false, reason: `lottery[${idx}].cost.item.id not number` }
  if (typeof cost.amount !== 'number') return { ok: false, reason: `lottery[${idx}].cost.amount not number` }
  if (!Array.isArray(r.boxes)) return { ok: false, reason: `lottery[${idx}].boxes not array` }
  return { ok: true, data: raw as AtlasLottery }
}

// ── fetch ヘルパー ──────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  console.log(`  fetch ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ── アイテム名マップ ─────────────────────────────────────────────────

interface AtlasItemEntry {
  id: number
  name: string
  icon: string
}

/** Atlas nice_item（全件、日本語）を取得して Map<id, {name, icon}> を返す */
async function fetchItemMap(): Promise<Map<number, { name: string; icon: string }>> {
  const items = await fetchJson<AtlasItemEntry[]>(`${origin}/export/${region}/nice_item.json`)
  const map = new Map<number, { name: string; icon: string }>()
  for (const item of items) {
    map.set(item.id, { name: item.name, icon: item.icon })
  }
  return map
}

// ── 変換ロジック ────────────────────────────────────────────────────

/** AtlasLottery → EventLotteryBox[] の変換（boxIndex でグルーピング） */
function compactLotteries(
  lottery: AtlasLottery,
  itemMap: Map<number, { name: string; icon: string }>,
): EventLotteryBox[] {
  const { cost, boxes } = lottery
  const boxIndices = [...new Set(boxes.map(b => b.boxIndex))].sort((a, b) => a - b)

  return boxIndices.map(bi => {
    const biBoxes = boxes.filter(b => b.boxIndex === bi)
    const draws = biBoxes.reduce((s, b) => s + b.maxNum, 0)
    const costPerBox = draws * cost.amount

    const contents = new Map<number, number>()
    const rareRewards: EventLotteryBox['rareRewards'] = []

    for (const box of biBoxes) {
      for (const gift of box.gifts) {
        const objType = gift.type ?? 'item'
        // 非アイテム（サーヴァント/礼装/コマンドコード）は isRare に関係なく
        // 素材(contents)に混ぜず rareRewards 側へ。contents は通常箱の素材のみに保つ。
        if (objType !== 'item' || box.isRare) {
          const meta = itemMap.get(gift.objectId)
          rareRewards.push({
            itemId: gift.objectId,
            num: gift.num * box.maxNum,
            objType,
            name: meta?.name ?? '',
            ...(meta?.icon ? { icon: meta.icon } : {}),
          })
        } else {
          contents.set(gift.objectId, (contents.get(gift.objectId) ?? 0) + gift.num * box.maxNum)
        }
      }
    }

    return {
      boxIndex: bi,
      costPerBox,
      contents: [...contents.entries()]
        .sort(([a], [b]) => a - b)
        .map(([itemId, num]) => {
          const meta = itemMap.get(itemId)
          return {
            itemId,
            num,
            name: meta?.name ?? '',
            ...(meta?.icon ? { icon: meta.icon } : {}),
          }
        }),
      rareRewards,
    }
  })
}

/** AtlasShopItem[] → EventShopItem[] の変換 */
function compactShop(
  shop: AtlasShopItem[],
  itemMap: Map<number, { name: string; icon: string }>,
): EventShopItem[] {
  return shop
    .filter(s => s.purchaseType === 'item' && s.payType === 'eventItem')
    .flatMap(s => {
      // gifts が空のときは targetIds × setNum で報酬を決定（Phase 0 確認済み）
      if (!s.targetIds || s.targetIds.length === 0) return []
      return s.targetIds.map(itemId => {
        const meta = itemMap.get(itemId)
        return {
          itemId,
          qty: s.setNum ?? 1,
          costItemId: s.cost.item.id,
          costAmount: s.cost.amount,
          limitNum: s.limitNum ?? 0,
          name: meta?.name ?? '',
          ...(meta?.icon ? { icon: meta.icon } : {}),
        }
      })
    })
}

/** AtlasWar + drop データ → EventFarmingNode[] の変換 */
async function compactFarmingNodes(
  warIds: number[],
  itemMap: Map<number, { name: string; icon: string }>,
): Promise<EventFarmingNode[]> {
  const nodes: EventFarmingNode[] = []

  for (const warId of warIds) {
    let war: AtlasWar
    try {
      war = await fetchJson<AtlasWar>(`${origin}/nice/${region}/war/${warId}`)
    } catch (e) {
      console.warn(`  skipping war ${warId}: ${e}`)
      continue
    }

    for (const spot of war.spots ?? []) {
      for (const q of spot.quests ?? []) {
        if (q.type !== 'event' || q.afterClear !== 'repeatLast') continue

        const phases = q.phases ?? [1]
        // Atlas は最終フェーズのドロップが最も充実している
        const lastPhase = phases[phases.length - 1] ?? 1

        let drops: EventFarmingNode['drops'] = []
        try {
          const qd = await fetchJson<AtlasQuestDetail>(
            `${origin}/nice/${region}/quest/${q.id}/${lastPhase}`
          )
          drops = (qd.drops ?? [])
            .filter(d => d.runs > 0)
            .map(d => {
              const meta = itemMap.get(d.objectId)
              return {
                itemId: d.objectId,
                perRun: Math.round((d.dropCount / d.runs) * d.num * 10000) / 10000,
                name: meta?.name ?? '',
                ...(meta?.icon ? { icon: meta.icon } : {}),
              }
            })
            .filter(d => d.perRun > 0.0001)
        } catch (e) {
          console.warn(`  skipping drops for quest ${q.id}: ${e}`)
        }

        nodes.push({
          questId: q.id,
          name: q.name,
          ap: q.consume,
          drops,
        })
      }
    }
  }

  return nodes
}

// ── メイン ────────────────────────────────────────────────────────────

async function main() {
  const outPath = process.argv[2] ?? './event_data.json'
  const nowSec = Math.floor(Date.now() / 1000)
  const graceSec = ENDED_GRACE_DAYS * 24 * 60 * 60

  console.log(`Fetching item map from ${origin}/export/${region}/nice_item.json...`)
  const itemMap = await fetchItemMap()
  console.log(`  Loaded ${itemMap.size} items`)

  console.log(`Fetching ${origin}/export/${region}/basic_event.json...`)
  const basicEvents = await fetchJson<BasicEvent[]>(
    `${origin}/export/${region}/basic_event.json`
  )

  // 対象フィルタ: eventQuest 型 & (開催中 or 終了後30日以内)
  const targets = basicEvents.filter(
    e =>
      e.type === 'eventQuest' &&
      e.endedAt > nowSec - graceSec
  )
  console.log(`Found ${targets.length} eventQuest events within window (now=${nowSec})`)

  const results: EventPlannerEvent[] = []

  for (const basic of targets) {
    console.log(`\nProcessing event ${basic.id} "${basic.name}"...`)
    let rawEvent: unknown
    try {
      rawEvent = await fetchJson<unknown>(`${origin}/nice/${region}/event/${basic.id}`)
    } catch (e) {
      console.warn(`  skip: fetch failed: ${e}`)
      continue
    }

    const validated = validateAtlasEvent(rawEvent)
    if (!validated.ok) {
      console.warn(`  skip: validation failed: ${validated.reason}`)
      continue
    }
    const event = validated.data

    // ロト型でないイベント（lotteries が空）はスキップ
    if (event.lotteries.length === 0) {
      console.log(`  skip: no lotteries (not a box event)`)
      continue
    }

    // lotteries のバリデーション
    const validLotteries: AtlasLottery[] = []
    for (let i = 0; i < event.lotteries.length; i++) {
      const vl = validateLottery(event.lotteries[i], i)
      if (!vl.ok) {
        console.warn(`  lottery[${i}] validation failed: ${vl.reason} — skipping lottery`)
        continue
      }
      validLotteries.push(vl.data)
    }
    if (validLotteries.length === 0) {
      console.warn(`  skip: all lotteries failed validation`)
      continue
    }

    // currency は最初のロトから取得（複数ロトの場合は同じ通貨を前提）
    const firstLot = validLotteries[0]
    const currency: EventCurrency = {
      id: firstLot.cost.item.id,
      name: firstLot.cost.item.name,
      icon: firstLot.cost.item.icon ?? '',
    }

    // ロトの全 boxIndex を結合して lotteries に格納
    // 複数ロトがある場合は最初の1つのみ対応（MVP スコープ）
    const lotteries = compactLotteries(firstLot, itemMap)

    const shop = compactShop(event.shop, itemMap)

    const farmingNodes = await compactFarmingNodes(event.warIds, itemMap)

    results.push({
      id: event.id,
      name: event.name,
      type: event.type,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      currency,
      // limited=false（最終箱が無限ループ）のとき箱数上限を解放する。
      // Atlas で未指定なら無限ループ扱い（FGO の箱ガチャの既定挙動）。
      unlimitedBoxes: firstLot.limited === false || firstLot.limited === undefined,
      lotteries,
      shop,
      farmingNodes,
    })

    console.log(
      `  ok: ${lotteries.length} boxes, ${shop.length} shop items, ${farmingNodes.length} farming nodes`
    )
  }

  if (results.length === 0) {
    throw new Error('Refusing to write: no lottery events extracted (would blank KV)')
  }

  const output: EventData = {
    events: results,
    updatedAt: nowSec,
  }

  writeFileSync(outPath, JSON.stringify(output))
  console.log(
    `\nWrote ${results.length} event(s) to ${outPath} (${JSON.stringify(output).length} bytes)`
  )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
