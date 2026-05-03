export interface Item {
  category: string
  name: string
  id: string
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

export interface MasterData {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
}

export interface DashboardEvent {
  id: number
  name: string
  banner: string
  startedAt: number
  endedAt: number
  shopFinishedAt: number
  type: string
  drops: { id: number; name: string; icon: string }[]
}

export interface DashboardGacha {
  id: number
  name: string
  banner: string
  fallbackBanner?: string | null
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

export interface DashboardMeta {
  events: DashboardEvent[]
  gachas: DashboardGacha[]
  recentServants: RecentServant[]
  updatedAt: number
}
