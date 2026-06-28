/* eslint-disable */
import { getResult } from '../../../../lib/get-result'
import { getLocalQuests } from '../../../../lib/get-local-quests'
import { getLocalItems } from '../../../../lib/get-local-items'
import { Page } from '../../../../components/farming/result'
import { notFound } from 'next/navigation'
import { DBError } from '../../../../lib/dynamodb'
import { isBothResult } from '../../../../interfaces/api'

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = 'ja'

  try {
    const raw = await getResult(id)

    if (isBothResult(raw)) {
      const [apItems, apQuests, lapItems, lapQuests] = await Promise.all([
        getLocalItems(raw.ap.items, locale),
        getLocalQuests(raw.ap.quests, locale),
        getLocalItems(raw.lap.items, locale),
        getLocalQuests(raw.lap.quests, locale),
      ])

      // batch_id があれば兄弟行(B行=ストック込み)も取得してタブ表示する。
      let stockApResult = undefined
      let stockLapResult = undefined
      if (raw.siblingResult && isBothResult(raw.siblingResult)) {
        const [sApItems, sApQuests, sLapItems, sLapQuests] = await Promise.all([
          getLocalItems(raw.siblingResult.ap.items, locale),
          getLocalQuests(raw.siblingResult.ap.quests, locale),
          getLocalItems(raw.siblingResult.lap.items, locale),
          getLocalQuests(raw.siblingResult.lap.quests, locale),
        ])
        stockApResult = { ...raw.siblingResult.ap, items: sApItems as any, quests: sApQuests as any }
        stockLapResult = { ...raw.siblingResult.lap, items: sLapItems as any, quests: sLapQuests as any }
      }

      return (
        <Page
          apResult={{ ...raw.ap, items: apItems as any, quests: apQuests as any }}
          lapResult={{ ...raw.lap, items: lapItems as any, quests: lapQuests as any }}
          createdAt={raw.createdAt}
          stockApResult={stockApResult}
          stockLapResult={stockLapResult}
        />
      )
    }

    // 後方互換: 旧形式の単一 Result
    const { items, quests, ...result } = raw
    const [localItems, localQuests] = await Promise.all([
      getLocalItems(items, locale),
      getLocalQuests(quests, locale),
    ])
    return (
      <Page
        legacyResult={{ ...result, items: localItems as any, quests: localQuests as any }}
        createdAt={raw.createdAt}
      />
    )
  } catch (e) {
    if (!(e instanceof DBError)) console.error(e)
    return notFound()
  }
}
