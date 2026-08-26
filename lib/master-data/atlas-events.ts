import { origin, region } from '../../constants/atlasacademy'
import type { Campaign, CampaignCalcType, PodFreePeriod } from './types'

// Atlas は恒常コンテンツの終了時刻にこの番兵値を使う。
const EVENT_PERMANENT_SENTINEL = 1893423600
// 異常系で active が極端に多い場合でも free プランの subrequest 上限を守るための上限。
// 通常の同時開催イベントは 1〜15 件程度。
const MAX_ACTIVE_EVENTS = 40

export interface BasicEvent {
  id: number
  startedAt: number
  finishedAt: number
}

export interface AtlasEventCampaign {
  target: string
  calcType: string
  value: number
  idx?: number
  targetIds?: number[]
  warIds?: number[]
  warGroupIds?: number[]
}

export interface AtlasEventCampaignQuest {
  questId: number
  phase?: number
  isExcepted?: boolean
}

export interface AtlasEventShopItem {
  cost?: { item?: { id: number; name: string; icon: string; type: string } }
}

export interface AtlasEvent {
  id: number
  name: string
  banner?: string
  startedAt: number
  endedAt: number
  finishedAt: number
  type: string
  // per-event API では shop[].cost.item がイベント素材(name/icon 内蔵)。
  // ダッシュボードの drop アイコン導出に使う(eventDropItems)。
  shop?: AtlasEventShopItem[]
  svts?: { svtId: number }[]
  campaigns?: AtlasEventCampaign[]
  campaignQuests?: AtlasEventCampaignQuest[]
  // ボックスガチャ(抽選)を持つイベントのみ。ダッシュボードの「ボックス計画」導線の
  // 出し分けに使う(lotteries が無いイベントはボックスイベントではない)。
  lotteries?: unknown[]
}

// basic_servant.json のエントリ(必要フィールドのみ)。dashboard と servants_list の
// 両フェーズで使うため、cron 1回で二重 fetch+parse しないよう共有できるようにする。
export interface BasicServantEntry {
  id: number
  name: string
  rarity: number
  collectionNo: number
  type: string
}

const readJson = async <T>(response: Response): Promise<T> => {
  const value: unknown = await response.json()
  return value as T
}

/**
 * 開催中(アクティブ)のイベントのみを取得する。
 *
 * 以前は nice_event.json(約40MB / 1430件)を丸ごと取得・parse していたが、
 * 消費側(AP キャンペーン抽出・ダッシュボード・pod-free 期間)はいずれも
 * 「現在開催中の数件」しか使わず、過去イベントは parse 直後に捨てていた。
 * この 40MB parse が cron の exceededCpu(CPU 上限超過)の主因だったため、
 * 以下の2段に置き換える:
 *   1. basic_event.json(約316KB)で全イベントの日付だけ取得しアクティブを絞る
 *   2. アクティブな数件だけ per-event API(/nice/{region}/event/{id})で詳細取得
 * これで parse 量が ~40MB → 1MB 未満に下がる。
 *
 * 注: per-event API は bulk nice_event の `quests[].drops` を含まないため、
 * ダッシュボードの drop アイコンは `shop[].cost.item`(イベント素材)から導出する
 * (eventDropItems 参照)。
 */
export async function fetchActiveEvents(nowSec?: number): Promise<AtlasEvent[]> {
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  const res = await fetch(`${origin}/export/${region}/basic_event.json`)
  const basic = await readJson<BasicEvent[]>(res)
  const activeIds = basic
    .filter(
      e =>
        e.startedAt <= now &&
        e.finishedAt > now &&
        e.finishedAt < EVENT_PERMANENT_SENTINEL
    )
    .map(e => e.id)

  if (activeIds.length > MAX_ACTIVE_EVENTS) {
    console.warn(
      `fetchActiveEvents: ${activeIds.length} active events exceeds cap ${MAX_ACTIVE_EVENTS}; truncating.`
    )
    activeIds.length = MAX_ACTIVE_EVENTS
  }

  const details = await Promise.all(
    activeIds.map(async id => {
      try {
        const r = await fetch(`${origin}/nice/${region}/event/${id}`)
        if (!r.ok) {
          console.warn(`fetchActiveEvents: per-event fetch failed for ${id} (status ${r.status})`)
          return null
        }
        return readJson<AtlasEvent>(r)
      } catch (e) {
        console.warn(`fetchActiveEvents: per-event fetch error for ${id}:`, e)
        return null
      }
    })
  )
  return details.filter((e): e is AtlasEvent => e !== null)
}

/**
 * per-event API には bulk nice_event の `quests[].drops` が無いため、イベントの
 * shop コストアイテム(= 周回で集めるイベント素材, name/icon を内包)から
 * ダッシュボード表示用の drop アイテム集合を導出する。
 */
export function eventDropItems(e: AtlasEvent): { id: number; name: string; icon: string }[] {
  const map = new Map<number, { id: number; name: string; icon: string }>()
  for (const s of e.shop ?? []) {
    const it = s.cost?.item
    if (!it || it.type !== 'eventItem') continue
    if (!map.has(it.id)) map.set(it.id, { id: it.id, name: it.name, icon: it.icon })
  }
  return Array.from(map.values())
}

const KNOWN_CAMPAIGN_CALC_TYPES = new Set<CampaignCalcType>([
  'multiplication',
  'fixedValue',
  'addition',
  'none',
])

const extractCampaignQuestShortIds = (
  campaignQuests: AtlasEventCampaignQuest[] | undefined,
  aaQuestIdToShortId: Map<number, string>,
  aaQuestIdToAfterClear?: Map<number, string>
): string[] => {
  const questIds: string[] = []
  const seen = new Set<string>()
  for (const cq of campaignQuests ?? []) {
    if (cq.isExcepted) continue
    const afterClear = aaQuestIdToAfterClear?.get(cq.questId)
    if (afterClear === 'close') continue
    const shortId = aaQuestIdToShortId.get(cq.questId)
    if (!shortId || seen.has(shortId)) continue
    seen.add(shortId)
    questIds.push(shortId)
  }
  return questIds
}

/**
 * Extract `target=questAp` campaigns from Atlas `nice_event.json` and
 * project their target quest list into the app's short quest ID space.
 *
 * - Skips `campaignQuests[].isExcepted === true`
 * - Skips quests with no aaQuestId mapping (e.g., main story quests
 *   not present in our drops data)
 * - Skips quests whose `afterClear === 'close'` (first-clear-only quests:
 *   main story, friendship, certain event one-shots). Their AP discount
 *   is a one-time bonus and has no farming value. Atlas's `nice_event.json`
 *   often bundles main-story quests into AP campaigns alongside repeatable
 *   ones; without this guard, our name-based aaQuestId matching can wrongly
 *   inherit those discounts onto repeatable free quests with similar names.
 * - Drops campaigns whose `calcType` is not one of the known values
 *   (logged for visibility); unmapped calcType is intentionally not
 *   surfaced as an error to avoid breaking master-data updates when
 *   Atlas introduces new values.
 */
export function extractApCampaigns(
  events: AtlasEvent[],
  aaQuestIdToShortId: Map<number, string>,
  aaQuestIdToAfterClear?: Map<number, string>
): Campaign[] {
  const out: Campaign[] = []
  for (const ev of events) {
    const apCampaigns = (ev.campaigns ?? []).filter(c => c.target === 'questAp')
    if (apCampaigns.length === 0) continue

    const questIds = extractCampaignQuestShortIds(
      ev.campaignQuests,
      aaQuestIdToShortId,
      aaQuestIdToAfterClear
    )
    if (questIds.length === 0) continue

    for (const c of apCampaigns) {
      if (!KNOWN_CAMPAIGN_CALC_TYPES.has(c.calcType as CampaignCalcType)) {
        console.warn(
          `extractApCampaigns: unknown calcType=${c.calcType} on event ${ev.id} (${ev.name}); skipping`
        )
        continue
      }
      out.push({
        id: ev.id,
        calcType: c.calcType as CampaignCalcType,
        value: c.value,
        validFrom: ev.startedAt,
        validTo: ev.finishedAt,
        questIds,
      })
    }
  }
  return out
}

const isPodFreeEvent = (ev: AtlasEvent, now: number): boolean => {
  if (ev.type !== 'questCampaign') return false
  if (!ev.name.includes('ストーム・ポッド消費なし') && !ev.name.includes('ストームポッド消費なし')) {
    return false
  }
  return ev.startedAt <= now && ev.endedAt > now
}

/**
 * Extract "ストーム・ポッド消費なし" campaign periods from Atlas events.
 *
 * Atlas does not model pod-free as a campaign target — it carries a noise
 * `questAp value=1000` (= ×1.0) campaign. The semantics live in `event.name`
 * + `campaignQuests`. We detect by name (both 中黒あり/なし表記) and project
 * `campaignQuests[].questId` (Atlas IDs) into our short quest ID space.
 *
 * Includes only currently-active periods (`now ∈ [startedAt, endedAt]`).
 */
export function extractPodFreePeriods(
  events: AtlasEvent[],
  aaQuestIdToShortId: Map<number, string>,
  nowSec?: number,
): PodFreePeriod[] {
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  const out: PodFreePeriod[] = []
  for (const ev of events) {
    if (!isPodFreeEvent(ev, now)) continue

    const questIds = extractCampaignQuestShortIds(ev.campaignQuests, aaQuestIdToShortId)
    if (questIds.length === 0) continue

    out.push({
      id: ev.id,
      name: ev.name,
      startedAt: ev.startedAt,
      endedAt: ev.endedAt,
      questIds,
    })
  }
  return out
}

export async function fetchBasicServants(): Promise<BasicServantEntry[]> {
  const res = await fetch(`${origin}/export/${region}/basic_servant.json`)
  return readJson<BasicServantEntry[]>(res)
}
