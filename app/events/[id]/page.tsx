import { getEventById, getEventRewards } from '../../../lib/get-events'
import { getItems } from '../../../lib/get-items'
import { getDrops } from '../../../lib/get-drops'
import { resolveUnitPrices } from '../../../lib/progress/lap-value'
import { featuresFor, isServantOnlyShop, resolveEventSummary } from '../../../lib/event-features'
import type { EventShopItem } from '../../../lib/master-data/types'
import { EventHubClient } from '../../../components/events/EventHubClient'
import { EventDataMissing } from '../../../components/events/EventDataMissing'

export const dynamic = 'force-dynamic'

/** 交換所の品目の分だけ、atlasId → 素材1個の AP 換算値を出す。ドロップ表が読めなければ空。 */
const loadShopApPrices = async (shop: EventShopItem[]): Promise<Record<number, number>> => {
  try {
    const prices = resolveUnitPrices(await getDrops(), [])
    // サーヴァント扱いの品目はドロップ表に現れないので引かない。
    const entries = shop.flatMap(({ itemId, kind }) => {
      if (kind === 'svt') return []
      const price = prices.get(String(itemId))
      return price ? [[itemId, price.apPrice] as const] : []
    })
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

interface Props {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const tabQuery = (await searchParams)?.tab
  const initialTab = typeof tabQuery === 'string' ? tabQuery : undefined
  const eventId = Number(id)

  if (Number.isNaN(eventId)) {
    return <EventDataMissing />
  }

  const kvEvent = await getEventById(eventId)
  const summary = resolveEventSummary(eventId, kvEvent)

  if (!summary) {
    return <EventDataMissing eventId={eventId} />
  }

  const features = featuresFor(eventId, kvEvent)
  // 不足の在庫基準（周回目的が「新規サーヴァントに備える」）に素材の分類を使うので、ボックス・交換所・料理作成のどれかがあれば読む。
  const needsItems = features.includes('box') || features.includes('shop') || features.includes('craft')
  const items = needsItems ? await getItems('ja') : undefined
  // ロトの有無によらず交換所の周回計算を出す。品目がすべてサーヴァント扱いの交換所は一覧だけを出すので、周回計算用のデータを読まない。
  const shopForCalc =
    features.includes('shop') && kvEvent && kvEvent.shop.length > 0 && !isServantOnlyShop(kvEvent.shop)
      ? kvEvent.shop
      : undefined
  const needsShopCalc = shopForCalc !== undefined
  const shopApPrices = shopForCalc ? await loadShopApPrices(shopForCalc) : undefined
  const pointItemId = needsShopCalc ? (await getEventRewards(eventId))?.pointItemId : undefined

  return (
    <EventHubClient
      summary={summary}
      boxEvent={kvEvent ?? undefined}
      items={items}
      features={features}
      shopApPrices={shopApPrices}
      pointItemId={pointItemId}
      initialTab={initialTab}
    />
  )
}
