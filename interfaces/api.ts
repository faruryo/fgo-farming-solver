export type Params = {
  objective: string
  items: { [key: string]: number }
  quests: string[]
}
export type Quest = {
  id: string
  section: string
  area: string
  name: string
  ap: number
  lap: number
  waves?: { enemies: { name: string; className: string; hp: number; attribute: string }[] }[]
}
export type Item = { id: string; category: string; name: string; count: number }
export type DropRate = {
  quest_id: string
  quest_name: string
  item_id: string
  item_name: string
  drop_rate: number
}
export type Result = {
  params: Params
  quests: Quest[]
  items: Item[]
  drop_rates: DropRate[]
  total_lap: number
  total_ap: number
  skipped_items?: string[]
}

export type BothResult = {
  ap: Result
  lap: Result
}

export const isBothResult = (r: Result | BothResult): r is BothResult =>
  'ap' in r && 'lap' in r
