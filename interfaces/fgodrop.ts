export type Item = { id: string; category: string; name: string }
export type Enemy = {
  name: string
  className: string
  hp: number
  attribute: string
}
export type Wave = {
  enemies: Enemy[]
}
export type Quest = {
  id: string
  section: string
  area: string
  name: string
  ap: number
  aaQuestId?: number
  waves?: Wave[]
}
export type DropRate = {
  item_id: string
  quest_id: string
  drop_rate: number
}
