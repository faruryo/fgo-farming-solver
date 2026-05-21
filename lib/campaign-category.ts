import type { DashboardCampaignInfo, DashboardEvent } from './master-data/types'

/**
 * banner レス questCampaign を 3 つのカテゴリに分類する。
 * - farming: ファーミング直結 (AP系・ポッド系・報酬系)
 * - upgrade: 強化・育成 (大成功・錬成・QP)
 * - other: その他 (フレポ・絆・経験値等)
 *
 * `questAp` ターゲットで `multiplication value=1000` (等倍) は「ノイズ campaign」と扱い、
 * ファーミング分類の根拠にしない。ただし event 名に「ストーム・ポッド」を含めば
 * その campaign 自体は無効でも event ごとファーミング扱いにする (ストーム・ポッド系の救済)。
 */

export type CampaignCategory = 'farming' | 'upgrade' | 'other'

const FARMING_TARGETS = new Set([
  'questAp',
  'questApFirstTime',
  'questUseRewardAddItem',
])
const UPGRADE_TARGETS = new Set([
  'largeSuccess',
  'superSuccess',
  'svtequipLargeSuccess',
  'svtequipSuperSuccess',
  'combineExp',
  'combineQp',
  'svtequipCombineQp',
  'exchangeSvt',
  'exchangeSvtCombineExp',
])

const STORM_POD_ITEM_ID = 49

export const isNoiseQuestAp = (c: DashboardCampaignInfo): boolean =>
  c.target === 'questAp' && c.calcType === 'multiplication' && c.value === 1000

const isFarmingCampaign = (c: DashboardCampaignInfo): boolean => {
  if (c.target === 'questUseRewardAddItem') {
    // ストーム・ポッド (item id 49) を対象としたものだけがファーミング直結。
    return (c.targetIds ?? []).includes(STORM_POD_ITEM_ID)
  }
  if (FARMING_TARGETS.has(c.target)) {
    return !isNoiseQuestAp(c)
  }
  return false
}

const isUpgradeCampaign = (c: DashboardCampaignInfo): boolean =>
  UPGRADE_TARGETS.has(c.target)

/**
 * Returns the category for a banner-less questCampaign event.
 * 「ストーム・ポッド」を name に含めば farming にエスカレーション (ノイズ campaign のみの event 救済)。
 */
export const categorizeCampaignEvent = (e: DashboardEvent): CampaignCategory => {
  const campaigns = e.campaigns ?? []
  if (e.name.includes('ストーム・ポッド') || e.name.includes('ストームポッド')) {
    return 'farming'
  }
  if (campaigns.some(isFarmingCampaign)) return 'farming'
  if (campaigns.some(isUpgradeCampaign)) return 'upgrade'
  return 'other'
}

/** "ストーム・ポッド消費なし" 期間の event (= CampaignSection で最上段固定)。 */
export const isPodFreeCampaignEvent = (e: DashboardEvent): boolean =>
  e.name.includes('ストーム・ポッド消費なし') || e.name.includes('ストームポッド消費なし')
