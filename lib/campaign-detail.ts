import type { Campaign } from '../interfaces/fgodrop'
import type { DashboardEvent, PodFreePeriod } from './master-data/types'
import { isPodFreeCampaignEvent } from './campaign-category'

/**
 * Resolve the target quest IDs for a CampaignSection event using available data sources.
 *
 * 初版でサポート:
 *   - Pod-free イベント: dashboardMeta.podFreePeriods に同 event id で格納
 *   - questAp キャンペーン: master-data.campaigns (Drops) に同 event id で格納
 *
 * それ以外の target (questFp / questFriendship / largeSuccess 等) は
 * master-data 抽出パイプラインに未追加なので空配列を返す。
 */
export type CampaignDetailKind = 'podFree' | 'questAp' | 'noData'

export interface CampaignDetail {
  kind: CampaignDetailKind
  /** 該当する quest の短 ID 群。`noData` のときは空。 */
  questIds: string[]
}

export const resolveCampaignDetail = (
  event: DashboardEvent,
  podFreePeriods: PodFreePeriod[] | undefined,
  masterCampaigns: Campaign[] | undefined,
): CampaignDetail => {
  // Pod-free を最優先で判定 (name + podFreePeriods)
  if (isPodFreeCampaignEvent(event)) {
    const period = (podFreePeriods ?? []).find(p => p.id === event.id)
    return { kind: 'podFree', questIds: period?.questIds ?? [] }
  }

  // questAp campaign は master-data.campaigns に event.id で格納されている
  const apCampaigns = (masterCampaigns ?? []).filter(c => c.id === event.id)
  if (apCampaigns.length > 0) {
    const ids = new Set<string>()
    for (const c of apCampaigns) {
      for (const id of c.questIds) ids.add(id)
    }
    return { kind: 'questAp', questIds: [...ids] }
  }

  return { kind: 'noData', questIds: [] }
}

/**
 * Human-readable summary of campaign effects for a banner-less event,
 * for use in the detail modal header.
 */
export const summarizeCampaignEffects = (event: DashboardEvent): string[] => {
  const lines: string[] = []
  for (const c of event.campaigns ?? []) {
    if (c.target === 'questAp') {
      if (c.calcType === 'multiplication') {
        const pct = Math.round((1 - c.value / 1000) * 100)
        if (pct > 0) lines.push(`消費 AP -${pct}%`)
        // value=1000 はノイズなので表示しない
      } else if (c.calcType === 'fixedValue') {
        lines.push(`消費 AP = ${c.value} に固定`)
      }
    } else if (c.target === 'questApFirstTime') {
      lines.push(`初回 AP 割引 (×${c.value / 1000})`)
    } else if (c.target === 'questUseRewardAddItem' && (c.targetIds ?? []).includes(49)) {
      lines.push(`ストーム・ポッド 報酬 ×${(c.value / 1000).toFixed(1)}`)
    } else if (c.target === 'largeSuccess' || c.target === 'svtequipLargeSuccess') {
      lines.push(`錬成大成功率 ×${(c.value / 1000).toFixed(1)}`)
    } else if (c.target === 'superSuccess' || c.target === 'svtequipSuperSuccess') {
      lines.push(`錬成超成功率 ×${(c.value / 1000).toFixed(1)}`)
    } else if (c.target === 'combineQp' || c.target === 'svtequipCombineQp') {
      lines.push(`錬成 QP ×${(c.value / 1000).toFixed(1)}`)
    } else if (c.target === 'combineExp') {
      lines.push(`錬成 EXP ×${(c.value / 1000).toFixed(1)}`)
    } else if (c.target === 'questFp') {
      lines.push(`フレンドポイント ×${(c.value / 1000).toFixed(1)}`)
    } else if (c.target === 'questFriendship') {
      lines.push(`絆ポイント ×${(c.value / 1000).toFixed(1)}`)
    }
  }
  return lines
}
