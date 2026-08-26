import { origin, region, staticOrigin } from '../../constants/atlasacademy'
import type { DashboardEvent, DashboardMeta, PodFreePeriod, Quest, RecentServant } from './types'
import {
  eventDropItems,
  extractPodFreePeriods,
  fetchActiveEvents,
  fetchBasicServants,
  type AtlasEvent,
  type BasicServantEntry,
} from './atlas-events'

export interface AtlasGacha {
  id: number
  name: string
  type: string
  imageId: number
  openedAt: number
  closedAt: number
  featuredSvtIds?: number[]
}

export interface FetchDashboardMetaOptions {
  events?: AtlasEvent[]
  servants?: BasicServantEntry[]
}

const PERMANENT_SENTINEL = 1893423600
const EVENT_TYPES = new Set(['eventQuest', 'war', 'questCampaign', 'itemQuest'])

const isWithinActiveTime = (e: AtlasEvent, now: number): boolean =>
  e.startedAt <= now && e.finishedAt > now && e.finishedAt < PERMANENT_SENTINEL

const buildServantReleaseDates = (
  gachas: AtlasGacha[],
  activeEvents: AtlasEvent[]
): Map<number, number> => {
  const dates = new Map<number, number>()
  for (const g of gachas) {
    for (const id of g.featuredSvtIds ?? []) {
      const prev = dates.get(id)
      if (prev === undefined || prev > g.openedAt) {
        dates.set(id, g.openedAt)
      }
    }
  }
  for (const e of activeEvents) {
    for (const es of e.svts ?? []) {
      const id = es.svtId
      const prev = dates.get(id)
      if (prev === undefined || prev > e.startedAt) {
        dates.set(id, e.startedAt)
      }
    }
  }
  return dates
}

const mapDashboardEvents = (events: AtlasEvent[]): DashboardEvent[] =>
  events.map(e => ({
    id: e.id,
    name: e.name,
    banner: e.banner ?? '',
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    shopFinishedAt: e.finishedAt,
    type: e.type,
    drops: eventDropItems(e),
    hasLottery: (e.lotteries?.length ?? 0) > 0,
  }))

const mapDashboardCampaigns = (events: AtlasEvent[]): DashboardEvent[] =>
  events.map(e => ({
    id: e.id,
    name: e.name,
    banner: null,
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    shopFinishedAt: e.finishedAt,
    type: e.type,
    drops: [],
    campaigns: (e.campaigns ?? []).map(c => ({
      target: c.target,
      calcType: c.calcType,
      value: c.value,
      targetIds: c.targetIds,
    })),
    campaignQuestsCount: (e.campaignQuests ?? []).filter(cq => !cq.isExcepted).length,
  }))

const filterRecentServants = (
  servants: BasicServantEntry[],
  dates: Map<number, number>,
  now: number
): RecentServant[] => {
  const threeMonthsAgo = now - (90 * 24 * 60 * 60)
  return servants
    .filter(s => (s.type === 'normal' || s.type === 'heroine') && s.collectionNo > 0)
    .map(s => ({
      id: s.id,
      name: s.name,
      rarity: s.rarity,
      collectionNo: s.collectionNo,
      face: `${staticOrigin}/JP/Faces/f_${s.id * 10}.png`,
      releasedAt: dates.get(s.id) || 0,
    }))
    .filter(s => s.releasedAt >= threeMonthsAgo && s.collectionNo > 350)
    .sort((a, b) => b.releasedAt - a.releasedAt || b.collectionNo - a.collectionNo)
}

const mapActiveGachas = (
  gachas: AtlasGacha[],
  svtLookup: Map<number, BasicServantEntry>,
  now: number
) =>
  gachas
    .filter(
      g =>
        g.openedAt <= now &&
        g.closedAt > now &&
        g.closedAt < PERMANENT_SENTINEL &&
        (g.type === 'stone' || g.type === 'chargeStone')
    )
    .map(g => ({
      id: g.id,
      name: g.name,
      banner: `${staticOrigin}/JP/SummonBanners/img_summon_${g.imageId}.png`,
      openedAt: g.openedAt,
      closedAt: g.closedAt,
      pickupServants: (g.featuredSvtIds || []).map(svtId => {
        const svt = svtLookup.get(svtId)
        return {
          id: svtId,
          name: svt?.name || '',
          rarity: svt?.rarity || 5,
          face: `${staticOrigin}/JP/Faces/f_${svtId * 10}.png`,
        }
      }),
    }))

export async function fetchDashboardMeta(
  masterQuests?: Quest[],
  opts: FetchDashboardMetaOptions = {}
): Promise<DashboardMeta> {
  const now = Math.floor(Date.now() / 1000)

  console.log('Fetching event, gacha and servant data from Atlas Academy...')
  const [allEvents, gachaRes, allServants] = await Promise.all([
    opts.events ? Promise.resolve(opts.events) : fetchActiveEvents(),
    fetch(`${origin}/export/${region}/nice_gacha.json`),
    opts.servants ? Promise.resolve(opts.servants) : fetchBasicServants(),
  ])

  const allGachas: AtlasGacha[] = await gachaRes.json()

  const activeEvents = allEvents.filter(
    e => isWithinActiveTime(e, now) && EVENT_TYPES.has(e.type) && Boolean(e.banner)
  )
  const activeBannerlessCampaigns = allEvents.filter(
    e => isWithinActiveTime(e, now) && e.type === 'questCampaign' && !e.banner && (e.campaigns?.length ?? 0) > 0
  )

  const servantReleaseDates = buildServantReleaseDates(allGachas, activeEvents)
  const recentServants = filterRecentServants(allServants, servantReleaseDates, now)
  const mappedEvents = mapDashboardEvents(activeEvents)
  const mappedCampaignEvents = mapDashboardCampaigns(activeBannerlessCampaigns)

  let podFreePeriods: PodFreePeriod[] = []
  if (masterQuests && masterQuests.length > 0) {
    const aaQuestIdToShortId = new Map<number, string>()
    for (const q of masterQuests) {
      if (typeof q.aaQuestId === 'number') {
        aaQuestIdToShortId.set(q.aaQuestId, q.id)
      }
    }
    podFreePeriods = extractPodFreePeriods(allEvents, aaQuestIdToShortId, now)
  }

  const svtLookup = new Map(allServants.map(s => [s.id, s]))
  const activeGachas = mapActiveGachas(allGachas, svtLookup, now)

  return {
    events: [...mappedEvents, ...mappedCampaignEvents],
    gachas: activeGachas,
    recentServants,
    updatedAt: Date.now(),
    podFreePeriods,
  }
}
