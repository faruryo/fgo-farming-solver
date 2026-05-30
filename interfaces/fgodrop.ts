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
  /** クリアに要する wave 数(=ターン数)。周回効率(ターン割り)の分母に使う。 */
  waveCount?: number
  /** クエスト報酬。効率ポイントへの任意加算(トグルON時)に使う。元 CSV の列から抽出。 */
  qp?: number
  /** 基本絆ポイント。 */
  bondPoints?: number
  /** マスターEXP。 */
  exp?: number
}
export type DropRate = {
  item_id: string
  quest_id: string
  drop_rate: number
}

export type CampaignCalcType = 'multiplication' | 'fixedValue' | 'addition' | 'none'

export type Campaign = {
  id: number
  calcType: CampaignCalcType
  value: number
  validFrom: number
  validTo: number
  questIds: string[]
}
