export interface Item {
  category: string
  name: string
  id: string
  largeCategory?: string
  shortName?: string
  icon?: string
}

export interface Enemy {
  name: string
  className: string
  hp: number
  attribute: string
}

export interface Wave {
  enemies: Enemy[]
}

export interface Quest {
  area: string
  ap: number
  name: string
  id: string
  section: string
  aaQuestId?: number
}

export interface DropRate {
  quest_id: string
  item_id: string
  drop_rate: number
}

export type CampaignCalcType = 'multiplication' | 'fixedValue' | 'addition' | 'none'

export interface Campaign {
  id: number
  calcType: CampaignCalcType
  value: number
  validFrom: number
  validTo: number
  questIds: string[]
}

export interface MasterData {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
  campaigns: Campaign[]
}

export interface DashboardCampaignInfo {
  target: string
  calcType: string
  value: number
  targetIds?: number[]
}

export interface DashboardEvent {
  id: number
  name: string
  /**
   * バナー画像 URL。`type=questCampaign` などのバナーレスイベントでは `null`。
   * EventSection はバナーあり、CampaignSection はバナーレスをそれぞれフィルタする。
   */
  banner: string | null
  startedAt: number
  endedAt: number
  shopFinishedAt: number
  type: string
  drops: { id: number; name: string; icon: string }[]
  /**
   * Atlas Academy `event.campaigns` の主要フィールドのみを保持。
   * バナーレスキャンペーンを CampaignSection で分類するために使う。
   */
  campaigns?: DashboardCampaignInfo[]
  /** Atlas Academy `event.campaignQuests` の件数 (`isExcepted=true` を含む生件数)。 */
  campaignQuestsCount?: number
}

export interface DashboardGacha {
  id: number
  name: string
  banner: string
  openedAt: number
  closedAt: number
  pickupServants: { id: number; name: string; rarity: number; face: string }[]
}

export interface RecentServant {
  id: number
  name: string
  rarity: number
  face: string
  releasedAt: number
  collectionNo: number
}

export interface PodFreePeriod {
  /** Source event id (Atlas Academy event.id), useful for deduplication & debugging. */
  id: number
  name: string
  startedAt: number
  endedAt: number
  /** Target quests projected into our app-internal short quest ID space. */
  questIds: string[]
}

export interface DashboardMeta {
  events: DashboardEvent[]
  gachas: DashboardGacha[]
  recentServants: RecentServant[]
  updatedAt: number
  /**
   * "ストーム・ポッド消費なし" キャンペーン期間。Atlas Academy 上で event name に
   * 「ストーム・ポッド消費なし」を含む `questCampaign` から抽出する。
   * 旧データとの後方互換のためオプショナル。
   */
  podFreePeriods?: PodFreePeriod[]
}
