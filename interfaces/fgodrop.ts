export type Item = { id: string; category: string; name: string }
export type Quest = {
  id: string
  section: string
  area: string
  name: string
  ap: number
}
export type DropRate = {
  item_id: string
  quest_id: string
  drop_rate: number
}
