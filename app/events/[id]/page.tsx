import { getEventById, getEventRewards } from '../../../lib/get-events'
import { getItems } from '../../../lib/get-items'
import { getDrops } from '../../../lib/get-drops'
import { resolveUnitPrices } from '../../../lib/progress/lap-value'
import { featuresFor, isServantOnlyShop, isShopOnlyEvent, resolveEventSummary } from '../../../lib/event-features'
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
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
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
  const items = features.includes('craft') ? await getItems('ja') : undefined
  // 品目がすべてサーヴァント扱いの交換所は一覧だけを出すので、周回計算用のデータを読まない。
  const shopOnly = isShopOnlyEvent(features, kvEvent) && !isServantOnlyShop(kvEvent.shop)
  const shopApPrices = shopOnly ? await loadShopApPrices(kvEvent.shop) : undefined
  const pointItemId = shopOnly ? (await getEventRewards(eventId))?.pointItemId : undefined

  return (
    <EventHubClient
      summary={summary}
      boxEvent={kvEvent ?? undefined}
      items={items}
      features={features}
      shopApPrices={shopApPrices}
      pointItemId={pointItemId}
    />
  )
}
