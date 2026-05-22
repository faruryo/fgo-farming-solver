import type { DashboardEvent } from './master-data/types'
import type { CampaignCategory } from './campaign-category'

export interface CampaignGroup {
  /** グループの共通 name (key) */
  name: string
  category: CampaignCategory
  /** このグループに含まれる個別 event (元データのまま、配列順は終了昇順)。 */
  events: DashboardEvent[]
  /** events[].campaignQuestsCount の合計。0 件はカウントされない。 */
  totalQuests: number
  /** events 中で最も早く終わる endedAt。 */
  earliestEndedAt: number
  /** events 中で最も遅く終わる endedAt。1 グループに end 違いがあるかの判定にも使える。 */
  latestEndedAt: number
}

export type CategorizedEvent = {
  event: DashboardEvent
  category: CampaignCategory
}

/**
 * 同じ event.name を持つキャンペーンを 1 グループにまとめる。
 *
 * Atlas は対象 quest 群が異なるたびに別 event を作るので、UI 上は同名の
 * "消費AP 50%DOWN" が 6-8 行並びがちで判別が難しい。グループ化して
 * 1 行で代表表示し、詳細モーダルで個別 sub-event を見せる方が直感的。
 */
export const groupCampaignsByName = (
  categorized: CategorizedEvent[],
): CampaignGroup[] => {
  const map = new Map<string, CampaignGroup>()
  for (const { event, category } of categorized) {
    const key = event.name
    const existing = map.get(key)
    const questCount = event.campaignQuestsCount ?? 0
    if (existing) {
      existing.events.push(event)
      existing.totalQuests += questCount
      existing.earliestEndedAt = Math.min(existing.earliestEndedAt, event.endedAt)
      existing.latestEndedAt = Math.max(existing.latestEndedAt, event.endedAt)
    } else {
      map.set(key, {
        name: key,
        category,
        events: [event],
        totalQuests: questCount,
        earliestEndedAt: event.endedAt,
        latestEndedAt: event.endedAt,
      })
    }
  }
  for (const g of map.values()) {
    g.events.sort((a, b) => a.endedAt - b.endedAt)
  }
  return [...map.values()]
}
