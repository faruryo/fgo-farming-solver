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
    cost?: number
    traits?: NiceTrait[]
    /** 再臨・霊衣ごとの特性の上書き。値は特性の完全な一覧で、空の配列は上書きなし。 */
    ascensionAdd?: { individuality?: { ascension?: Record<string, NiceTrait[]>; costume?: Record<string, NiceTrait[]> } }
  }

export type NiceTrait = { id: number; name?: string; negative?: boolean }

/** 概念礼装(nice_equip)。絆アップ礼装の蒸留に使う項目だけ型を付ける。 */
export type NiceEquip = {
  id: number
  collectionNo: number
  name: string
  rarity: number
  cost: number
  extraAssets?: { faces?: { equip?: Record<string, string> } }
  skills: NiceEquipSkill[]
}

type NiceEquipSval = { RateCount?: number; AddCount?: number; EventId?: number; Individuality?: number }

export type NiceEquipSkill = {
  condLimitCount: number
  detail?: string
  functions: {
    funcType: string
    funcTargetType: string
    svals: NiceEquipSval[]
    /** いずれかの特性を持つ相手に効く。 */
    functvals?: NiceTrait[]
    /** 内側のすべての特性を持つ相手に効き、外側はいずれか。空でなければ functvals より優先する。 */
    overWriteTvalsList?: NiceTrait[][]
    funcquestTvals?: NiceTrait[]
    /** サポートで付けたときの svals。 */
    followerVals?: NiceEquipSval[]
  }[]
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
