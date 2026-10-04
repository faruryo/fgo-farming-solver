export type ClassName =
  | 'saber'
  | 'archer'
  | 'lancer'
  | 'rider'
  | 'caster'
  | 'assassin'
  | 'berserker'
  | 'shielder'
  | 'ruler'
  | 'avenger'
  | 'alterEgo'
  | 'moonCancer'
  | 'foreigner'
  | 'pretender'
  | 'beast'
  | 'beastEresh'
  | 'unBeastOlgaMarie'


export type TargetKey = 'ascension' | 'skill' | 'appendSkill'
export type MaterialsKey = `${TargetKey}Materials`

export type Servant = {
  id: number
  collectionNo: number
  name: string
  type: string
  flag: string
  className: ClassName
  attribute: string
  rarity: number
  extraAssets: {
    faces: {
      ascension?: Record<string, string>
      costume?: Record<string, string>
    }
    charaGraph: {
      ascension?: Record<string, string>
      costume?: Record<string, string>
    }
  }
}

export type MaterialsRecord = Record<MaterialsKey, Materials>

export type NiceServant = Servant &
  MaterialsRecord & {
    /** 絆Lvごとの累積必要ポイント(index 0 が Lv1 到達に必要な累積値)。 */
    bondGrowth?: number[]
    extraPassive?: NiceExtraPassiveSkill[]
  }

/** イベント特攻・絆ボーナスなど、期間やイベントに紐づく追加パッシブ。必要な項目だけ型を付ける。 */
export type NiceExtraPassiveSkill = {
  extraPassive: { eventId: number; startedAt: number; endedAt: number }[]
  functions: {
    funcType: string
    buffs: { type: string }[]
    svals: { Value?: number; RateCount?: number }[]
  }[]
}

export type Materials = {
  [key: string]: {
    items: {
      item: Item
      amount: number
    }[]
    qp: number
  }
}

export type Item = {
  id: number
  name: string
  type: string
  uses: 'skill' | 'ascension' | 'costume'
  detail: string
  icon: string
  background: 'zero' | 'bronze' | 'silver' | 'gold' | 'questClearQPReward'
  priority: number
  dropPriority: number
}

export type War = {
  id: number
  coordinates: [[number, number], [number, number]]
  age: string
  name: string
  longName: string
  eventId: number
  eventName: string
}
