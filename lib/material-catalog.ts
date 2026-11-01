import type {
  ClassName,
  Item,
  MaterialsKey,
  NiceEquip,
  NiceEquipSkill,
  NiceServant,
} from '../interfaces/atlas-academy'
import type { MaterialsForServants, ReducedMaterials } from './get-materials'
import { extractEventBonuses, type ServantEventBonus } from './event-bonus'

export const MATERIAL_CATALOG_KEY = 'material_catalog_v1'
export const MATERIAL_CATALOG_SCHEMA_VERSION = 1 as const
export const MATERIAL_CATALOG_MAX_BYTES = 5 * 1024 * 1024

export type SourceValidator = { etag?: string; lastModified?: string }

export type MaterialCatalogServant = Pick<
  NiceServant,
  'id' | 'name' | 'className' | 'collectionNo' | 'rarity'
> & {
  face: string | null
  bondGrowth?: number[]
  eventBonuses?: ServantEventBonus[]
  cost?: number
  /** 基本の特性 ID。 */
  traits?: number[]
  /** 第1再臨・第2再臨・第3再臨・最終再臨の特性 ID の完全な一覧。どれかの段階が traits と違うサーヴァントだけが持つ。 */
  ascensionTraits?: number[][]
}

/**
 * 獲得絆を増やす概念礼装。値は最大解放時のもの。
 * rate はパーティ全体の増加率(千分率)、add は固定の増加量。target が self のときは add だけを持つ。
 */
export type MaterialCatalogBondUpCraftEssence = {
  id: number
  collectionNo: number
  name: string
  rarity: number
  cost: number
  face: string
  target: 'party' | 'self'
  rate: number
  add: number
  /**
   * 効く相手の条件。いずれかの組の特性をすべて持つ相手に効き、[] は全員に効く。
   * 蒸留は常に書く。項目がないのは条件を足す前のカタログ。
   */
  appliesTo?: number[][]
  /** 条件付きの礼装の効く相手の表記(効果文の最初の〔から最後の〕まで)。 */
  appliesToLabel?: string
  /** サポートで付けたときの増加率(千分率)。自分で付けたときと異なる礼装だけが持つ。 */
  supportRate?: number
}

export type MaterialCatalogItem = Pick<Item, 'id' | 'name' | 'icon'>

export const MATERIAL_CLASS_NAMES: ClassName[] = [
  'saber',
  'archer',
  'lancer',
  'rider',
  'caster',
  'assassin',
  'berserker',
  'shielder',
  'ruler',
  'avenger',
  'alterEgo',
  'moonCancer',
  'foreigner',
  'pretender',
  'beast',
  'beastEresh',
  'unBeastOlgaMarie',
]

export const isMaterialClassName = (value: string): value is ClassName =>
  MATERIAL_CLASS_NAMES.includes(value as ClassName)

export type MaterialCatalogV1 = {
  schemaVersion: typeof MATERIAL_CATALOG_SCHEMA_VERSION
  updatedAt: number
  sources: {
    niceServant: SourceValidator
    niceItem: SourceValidator
    niceEquip?: SourceValidator
  }
  servants: MaterialCatalogServant[]
  materials: MaterialsForServants
  items: MaterialCatalogItem[]
  bondUpCraftEssences?: MaterialCatalogBondUpCraftEssence[]
}

export const materialCatalogFace = (servant: NiceServant): string | null => {
  const faces = servant.extraAssets?.faces
  return (
    faces?.ascension?.['1'] ??
    faces?.ascension?.['0'] ??
    Object.values(faces?.ascension ?? {})[0] ??
    null
  )
}

/** 1要素以上・各要素が有限の正値・単調非減少のときだけ有効な絆Lv別累積必要ポイント。 */
export const isValidBondGrowth = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (point, index) =>
      isFinitePositive(point) && (index === 0 || point >= (value[index - 1] as number)),
  )

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

// 第2再臨は再臨1と2のどちらで編成しても持つ特性だけを数えるため、両方の積集合にする。
const ASCENSION_STAGE_KEYS = [['0'], ['1', '2'], ['3'], ['4']]

/** 1要素以上・正の整数・重複なしの特性 ID の一覧。 */
const isValidTraitIds = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(isPositiveInteger) &&
  new Set(value).size === value.length

const isValidAscensionTraits = (value: unknown): value is number[][] =>
  Array.isArray(value) && value.length === ASCENSION_STAGE_KEYS.length && value.every(isValidTraitIds)

/** 「持たない」を表す特性は ID として読まない(正の整数でない値にして検証で落とす)。 */
const traitIdsOf = (traits: readonly unknown[]): unknown[] =>
  traits.map(trait => (isRecord(trait) && trait.negative !== true ? trait.id : undefined))

const isSameTraitSet = (stage: readonly unknown[], traits: readonly number[]): boolean => {
  const base = new Set<unknown>(traits)
  return stage.length === traits.length && stage.every(trait => base.has(trait))
}

/** nice_servant の基本の特性と、霊基再臨の段階ごとの特性を蒸留する。霊衣の特性は開放していないと使えないので読まない。 */
const distillServantTraits = (servant: NiceServant): Pick<MaterialCatalogServant, 'traits' | 'ascensionTraits'> => {
  const traits = Array.isArray(servant.traits) ? traitIdsOf(servant.traits) : undefined
  if (!isValidTraitIds(traits)) return {}
  const ascension = servant.ascensionAdd?.individuality?.ascension ?? {}
  // 空の再臨は上書きなし。空でない値は特性の完全な一覧。
  const stageOf = (key: string): unknown[] => {
    const value: unknown = Object.getOwnPropertyDescriptor(ascension, key)?.value
    return Array.isArray(value) && value.length > 0 ? traitIdsOf(value) : traits
  }
  const stages = ASCENSION_STAGE_KEYS.map(([first, ...rest]) =>
    rest.map(stageOf).reduce((common, next) => common.filter(trait => next.includes(trait)), stageOf(first)))
  if (stages.every(stage => isSameTraitSet(stage, traits))) return { traits }
  return isValidAscensionTraits(stages) ? { traits, ascensionTraits: stages } : { traits }
}

const catalogServantTraits = (servant: MaterialCatalogServant): Pick<MaterialCatalogServant, 'traits' | 'ascensionTraits'> => {
  if (!isValidTraitIds(servant.traits)) return {}
  return isValidAscensionTraits(servant.ascensionTraits)
    ? { traits: [...servant.traits], ascensionTraits: servant.ascensionTraits.map(stage => [...stage]) }
    : { traits: [...servant.traits] }
}

const BOND_UP_FUNC_TYPE = 'servantFriendshipUp'
const BOND_UP_TARGETS: Record<string, MaterialCatalogBondUpCraftEssence['target']> = {
  ptFull: 'party',
  self: 'self',
}

type BondUpEffect = Pick<
  MaterialCatalogBondUpCraftEssence,
  'target' | 'rate' | 'add' | 'appliesToLabel' | 'supportRate'
> & { appliesTo: number[][] }

type BondUpFunction = NiceEquipSkill['functions'][number]

type BondUpFunctionEffect = Pick<BondUpEffect, 'target' | 'rate' | 'add' | 'appliesTo'> & { supportRate: number }

const BOND_UP_SVAL_KEYS = new Set(['Individuality', 'RateCount', 'AddCount', 'EventId'])

const isValidTraitGroups = (value: unknown): value is number[][] =>
  Array.isArray(value) &&
  value.every(group => Array.isArray(group) && group.length > 0 && group.every(isPositiveInteger))

/** overWriteTvalsList が空でなければその各組、空なら functvals の各特性を1つずつの組にする。読めなければ null。 */
const bondUpAppliesTo = (fn: BondUpFunction): number[][] | null => {
  const groups = fn.overWriteTvalsList?.length
    ? fn.overWriteTvalsList.map(group => (Array.isArray(group) ? traitIdsOf(group) : []))
    : (fn.functvals ?? []).map(trait => traitIdsOf([trait]))
  return isValidTraitGroups(groups) ? groups : null
}

/** 読めない値やクエストの条件を持つ効果は、効く相手を取り違えないよう読まない。 */
const hasUnreadableCondition = (fn: BondUpFunction, sval: NonNullable<BondUpFunction['svals'][number]>): boolean =>
  Object.keys(sval).some(key => !BOND_UP_SVAL_KEYS.has(key)) || !!fn.funcquestTvals?.length

const bondUpFunctionEffect = (fn: BondUpFunction): BondUpFunctionEffect | null => {
  if (fn.funcType !== BOND_UP_FUNC_TYPE || !Object.hasOwn(BOND_UP_TARGETS, fn.funcTargetType)) return null
  const target = BOND_UP_TARGETS[fn.funcTargetType]
  const sval = fn.svals.at(-1)
  // イベント期間限定・svals 側の特性限定の効果は提案の対象にしない。
  if (!sval || sval.EventId || sval.Individuality || hasUnreadableCondition(fn, sval)) return null
  const appliesTo = bondUpAppliesTo(fn)
  if (!appliesTo) return null
  // shortcut: 自身に効く増加率はイベント限定を除くと存在しないため読まない。
  const rate = target === 'party' ? sval.RateCount ?? 0 : 0
  const followerRate = fn.followerVals?.at(-1)?.RateCount
  const supportRate = target === 'party' && typeof followerRate === 'number' ? followerRate : rate
  return { target, rate, add: sval.AddCount ?? 0, appliesTo, supportRate }
}

const appliesToKey = (appliesTo: readonly number[][]): string =>
  JSON.stringify(appliesTo.map(group => [...group].sort((a, b) => a - b).join(',')).sort((a, b) => a.localeCompare(b)))

/** 効果文の最初の〔から最後の〕まで。 */
const bracketedLabel = (detail: string): string | undefined => {
  const start = detail.indexOf('〔')
  const end = detail.lastIndexOf('〕')
  return start >= 0 && end > start ? detail.slice(start, end + 1) : undefined
}

const appliesToLabelOf = (skills: readonly NiceEquipSkill[]): string | undefined =>
  skills.map(skill => bracketedLabel(skill.detail ?? '')).find(isDisplayString)

const bondUpEffect = (equip: NiceEquip): BondUpEffect | null => {
  const skills = (equip.skills ?? []).filter(skill =>
    skill.functions.some(fn => fn.funcType === BOND_UP_FUNC_TYPE),
  )
  if (!skills.length) return null
  // 未解放と最大解放の2段を持つ礼装は最大解放の段だけを読む。
  const maxLimit = Math.max(...skills.map(skill => skill.condLimitCount))
  const maxSkills = skills.filter(skill => skill.condLimitCount === maxLimit)
  const totals = new Map<string, BondUpFunctionEffect>()
  for (const effect of maxSkills.flatMap(skill => skill.functions.map(bondUpFunctionEffect))) {
    if (!effect) continue
    const key = `${effect.target}|${appliesToKey(effect.appliesTo)}`
    const total = totals.get(key)
    totals.set(key, total
      ? { ...total, rate: total.rate + effect.rate, add: total.add + effect.add, supportRate: total.supportRate + effect.supportRate }
      : effect)
  }
  // shortcut: 対象(パーティ全体と自身)や効く相手の条件が混ざる礼装はイベント限定を除くと存在しないため一覧に入れない。
  if (totals.size !== 1) return null
  const [{ target, rate, add, appliesTo, supportRate }] = [...totals.values()]
  if (rate <= 0 && add <= 0) return null
  const appliesToLabel = appliesTo.length ? appliesToLabelOf(maxSkills) : undefined
  // 効く相手を表記できない条件付きの礼装は、条件を読めない礼装として扱う。
  if (appliesTo.length && !appliesToLabel) return null
  return {
    target,
    rate,
    add,
    appliesTo,
    ...(appliesToLabel ? { appliesToLabel } : {}),
    ...(supportRate === rate ? {} : { supportRate }),
  }
}

/** nice_equip から、イベント限定でなく効く相手の条件を読める獲得絆の増加効果を持つ礼装を図鑑番号順に蒸留する。 */
export const distillBondUpCraftEssences = (
  equips: NiceEquip[],
): MaterialCatalogBondUpCraftEssence[] =>
  equips
    .flatMap(equip => {
      const effect = bondUpEffect(equip)
      if (!effect) return []
      return [{
        id: equip.id,
        collectionNo: equip.collectionNo,
        name: equip.name,
        rarity: equip.rarity,
        cost: equip.cost,
        face: Object.values(equip.extraAssets?.faces?.equip ?? {})[0] ?? '',
        ...effect,
      }]
    })
    .sort((a, b) => a.collectionNo - b.collectionNo || a.id - b.id)

export const buildMaterialCatalog = ({
  servants,
  materials,
  items,
  bondUpCraftEssences,
  sources,
  updatedAt,
  eventNames,
}: {
  servants: Array<NiceServant | MaterialCatalogServant>
  materials: MaterialsForServants
  items: Array<Item | MaterialCatalogItem>
  bondUpCraftEssences?: MaterialCatalogBondUpCraftEssence[]
  sources: MaterialCatalogV1['sources']
  updatedAt: number
  eventNames?: ReadonlyMap<number, string>
}): MaterialCatalogV1 => ({
  schemaVersion: MATERIAL_CATALOG_SCHEMA_VERSION,
  updatedAt,
  sources,
  servants: servants.map((servant) => ({
    id: servant.id,
    name: servant.name,
    className: servant.className,
    collectionNo: servant.collectionNo,
    rarity: servant.rarity,
    face:
      'extraAssets' in servant ? materialCatalogFace(servant) : servant.face,
    ...(isValidBondGrowth(servant.bondGrowth)
      ? { bondGrowth: [...servant.bondGrowth] }
      : {}),
    ...(isNonNegativeInteger(servant.cost) ? { cost: servant.cost } : {}),
    ...('extraAssets' in servant ? distillServantTraits(servant) : catalogServantTraits(servant)),
    eventBonuses:
      'extraAssets' in servant
        ? extractEventBonuses(servant.extraPassive, Math.floor(updatedAt / 1000), eventNames)
        : servant.eventBonuses ?? [],
  })),
  materials,
  items: items.map(({ id, name, icon }) => ({ id, name, icon })),
  ...(bondUpCraftEssences ? { bondUpCraftEssences } : {}),
})

export const materialCatalogFingerprint = (
  catalog: MaterialCatalogV1,
): string =>
  JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    servants: catalog.servants,
    materials: catalog.materials,
    items: catalog.items,
    bondUpCraftEssences: catalog.bondUpCraftEssences,
  })

export const materialCatalogItemIds = (
  materials: MaterialsForServants,
): Set<number> => {
  const ids = new Set<number>()
  for (const records of Object.values(materials)) {
    for (const levels of Object.values(records)) {
      for (const level of Object.values(levels)) {
        for (const { item } of level.items) ids.add(item.id)
      }
    }
  }
  return ids
}

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isFinitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isDisplayString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const servantDisplayError = (servant: unknown): string | null => {
  if (!isRecord(servant)) return 'invalid servant display fields'
  if (!isPositiveInteger(servant.id) || !isDisplayString(servant.name))
    return 'invalid servant display fields'
  if (
    typeof servant.className !== 'string' ||
    !isMaterialClassName(servant.className)
  )
    return 'invalid servant display fields'
  if (
    !isPositiveInteger(servant.collectionNo) ||
    !isFiniteNonNegative(servant.rarity)
  )
    return 'invalid servant display fields'
  return servant.face === null || isDisplayString(servant.face)
    ? null
    : 'invalid servant display fields'
}

const servantTraitsError = (servant: MaterialCatalogServant): string | null =>
  (servant.traits === undefined || isValidTraitIds(servant.traits)) &&
  (servant.ascensionTraits === undefined || isValidAscensionTraits(servant.ascensionTraits))
    ? null
    : 'invalid servant traits'

const itemDisplayError = (item: unknown): string | null => {
  if (!isRecord(item)) return 'invalid item display fields'
  if (
    !isPositiveInteger(item.id) ||
    !isDisplayString(item.name) ||
    !isDisplayString(item.icon)
  ) {
    return 'invalid item display fields'
  }
  return null
}

const bondUpCraftEssenceError = (essence: unknown): string | null => {
  if (!isRecord(essence)) return 'invalid bond-up craft essence'
  if (
    !isPositiveInteger(essence.id) ||
    !isDisplayString(essence.name) ||
    !isDisplayString(essence.face) ||
    !isPositiveInteger(essence.cost) ||
    (essence.target !== 'party' && essence.target !== 'self') ||
    !isFiniteNonNegative(essence.rate) ||
    !isFiniteNonNegative(essence.add) ||
    (essence.rate <= 0 && essence.add <= 0)
  ) {
    return 'invalid bond-up craft essence'
  }
  return bondUpCraftEssenceConditionError(essence)
}

const bondUpCraftEssenceConditionError = ({ appliesTo, appliesToLabel, supportRate }: Record<string, unknown>): string | null =>
  isValidTraitGroups(appliesTo) &&
  (appliesTo.length === 0 || isDisplayString(appliesToLabel)) &&
  (supportRate === undefined || isFiniteNonNegative(supportRate))
    ? null
    : 'invalid bond-up craft essence'

const bondUpCraftEssencesError = (catalog: MaterialCatalogV1): string | null => {
  const essences = catalog.bondUpCraftEssences
  if (!Array.isArray(essences) || !essences.length) return 'bond-up craft essences is empty'
  for (const essence of essences) {
    const error = bondUpCraftEssenceError(essence)
    if (error) return error
  }
  return new Set(essences.map(essence => essence.id)).size === essences.length
    ? null
    : 'duplicate bond-up craft essence id'
}

const displayFieldsError = (catalog: MaterialCatalogV1): string | null => {
  for (const servant of catalog.servants) {
    const error = servantDisplayError(servant) ?? servantTraitsError(servant)
    if (error) return error
  }
  for (const item of catalog.items) {
    const error = itemDisplayError(item)
    if (error) return error
  }
  return null
}

const REQUIRED_MATERIAL_TABLES: MaterialsKey[] = [
  'ascensionMaterials',
  'skillMaterials',
  'appendSkillMaterials',
]

const EXPECTED_MATERIAL_LEVELS: Record<MaterialsKey, string[]> = {
  ascensionMaterials: ['0', '1', '2', '3'],
  skillMaterials: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  appendSkillMaterials: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
}

const MASH_SERVANT_ID = 800100

const isMaterialLevelKey = (value: string): boolean =>
  /^(0|[1-9]\d*)$/.test(value)

const materialEntryError = (
  material: unknown,
  itemIds: Set<number>,
): string | null => {
  if (
    !material ||
    typeof material !== 'object' ||
    !('item' in material) ||
    !('amount' in material)
  ) {
    return 'invalid material item'
  }
  const { item, amount } = material
  if (
    !item ||
    typeof item !== 'object' ||
    !('id' in item) ||
    typeof item.id !== 'number'
  ) {
    return 'invalid material item'
  }
  if (!itemIds.has(item.id)) return `unknown material item ${item.id}`
  return isFinitePositive(amount) ? null : 'invalid material amount'
}

const materialLevelError = (
  levelKey: string,
  level: unknown,
  tableKey: MaterialsKey,
  servantId: number,
  itemIds: Set<number>,
): string | null => {
  if (!isMaterialLevelKey(levelKey))
    return `invalid material level ${tableKey}.${levelKey} for servant ${servantId}`
  if (
    !level ||
    typeof level !== 'object' ||
    Array.isArray(level) ||
    !('qp' in level) ||
    !('items' in level) ||
    !Array.isArray(level.items)
  ) {
    return `invalid material level ${tableKey}.${levelKey} for servant ${servantId}`
  }
  if (!isFinitePositive(level.qp)) return 'invalid qp'
  if (!level.items.length) {
    return `empty material level ${tableKey}.${levelKey} for servant ${servantId}`
  }
  for (const material of level.items) {
    const error = materialEntryError(material, itemIds)
    if (error) return error
  }
  return null
}

const materialTableError = (
  table: unknown,
  tableKey: MaterialsKey,
  servantId: number,
  itemIds: Set<number>,
): string | null => {
  if (!table)
    return `missing material table ${tableKey} for servant ${servantId}`
  if (typeof table !== 'object' || Array.isArray(table))
    return `invalid material table ${tableKey} for servant ${servantId}`
  const levels = Object.entries(table)
  if (!levels.length && tableKey === 'ascensionMaterials' && servantId === MASH_SERVANT_ID) {
    return null
  }
  if (!levels.length)
    return `empty material table ${tableKey} for servant ${servantId}`
  for (const [levelKey, level] of levels) {
    const error = materialLevelError(
      levelKey,
      level,
      tableKey,
      servantId,
      itemIds,
    )
    if (error) return error
  }
  const expectedLevelKeys = Object.getOwnPropertyDescriptor(
    EXPECTED_MATERIAL_LEVELS,
    tableKey,
  )?.value as string[]
  for (const levelKey of expectedLevelKeys) {
    if (!Object.hasOwn(table, levelKey)) {
      return `missing material level ${tableKey}.${levelKey} for servant ${servantId}`
    }
  }
  for (const [levelKey] of levels) {
    if (!expectedLevelKeys.includes(levelKey)) {
      return `unexpected material level ${tableKey}.${levelKey} for servant ${servantId}`
    }
  }
  return null
}

const validateMaterials = (
  catalog: MaterialCatalogV1,
  itemIds: Set<number>,
): string | null => {
  for (const servant of catalog.servants) {
    const records = catalog.materials[servant.id]
    if (!records) return `missing materials for servant ${servant.id}`
    for (const key of REQUIRED_MATERIAL_TABLES) {
      const error = materialTableError(
        Object.getOwnPropertyDescriptor(records, key)?.value,
        key,
        servant.id,
        itemIds,
      )
      if (error) return error
    }
  }
  return null
}

const materialEntryCount = (catalog: MaterialCatalogV1): number =>
  catalog.servants.reduce((count, servant) => {
    const records = catalog.materials[servant.id]
    return (
      count +
      REQUIRED_MATERIAL_TABLES.reduce(
        (tableCount, key) => {
          const table = Object.getOwnPropertyDescriptor(records, key)
            ?.value as ReducedMaterials
          return tableCount + Object.values(table).reduce(
            (levelCount, level) => levelCount + level.items.length,
            0,
          )
        },
        0,
      )
    )
  }, 0)

const materialQuantityTotals = (
  catalog: MaterialCatalogV1,
): { amount: number; qp: number } =>
  catalog.servants.reduce(
    (totals, servant) => {
      const records = catalog.materials[servant.id]
      for (const key of REQUIRED_MATERIAL_TABLES) {
        const table = Object.getOwnPropertyDescriptor(records, key)
          ?.value as ReducedMaterials
        for (const level of Object.values(table)) {
          totals.qp += level.qp
          for (const material of level.items) totals.amount += material.amount
        }
      }
      return totals
    },
    { amount: 0, qp: 0 },
  )

const hasUnexpectedCountDrop = (candidate: number, previous: number): boolean =>
  candidate < previous * 0.8

const previousCatalogError = (
  catalog: MaterialCatalogV1,
  previous: MaterialCatalogV1,
): string | null => {
  if (hasUnexpectedCountDrop(catalog.servants.length, previous.servants.length)) {
    return 'servant count dropped unexpectedly'
  }
  if (hasUnexpectedCountDrop(materialEntryCount(catalog), materialEntryCount(previous))) {
    return 'material entry count dropped unexpectedly'
  }
  if (hasUnexpectedCountDrop(catalog.items.length, previous.items.length)) {
    return 'projected item count dropped unexpectedly'
  }
  if (
    hasUnexpectedCountDrop(
      catalog.bondUpCraftEssences?.length ?? 0,
      previous.bondUpCraftEssences?.length ?? 0,
    )
  ) {
    return 'bond-up craft essence count dropped unexpectedly'
  }
  const candidateTotals = materialQuantityTotals(catalog)
  const previousTotals = materialQuantityTotals(previous)
  if (hasUnexpectedCountDrop(candidateTotals.amount, previousTotals.amount)) {
    return 'material quantity dropped unexpectedly'
  }
  if (hasUnexpectedCountDrop(candidateTotals.qp, previousTotals.qp)) {
    return 'QP total dropped unexpectedly'
  }
  return null
}

export const validateMaterialCatalog = (
  catalog: MaterialCatalogV1,
  previous?: MaterialCatalogV1,
): { ok: true } | { ok: false; reason: string } => {
  if (catalog.schemaVersion !== MATERIAL_CATALOG_SCHEMA_VERSION)
    return { ok: false, reason: 'unsupported schema version' }
  if (!catalog.servants.length || !catalog.items.length)
    return { ok: false, reason: 'servants or items is empty' }
  if (!isFiniteNonNegative(catalog.updatedAt))
    return { ok: false, reason: 'updatedAt is invalid' }
  const displayError = displayFieldsError(catalog)
  if (displayError) return { ok: false, reason: displayError }
  if (
    new Set(catalog.servants.map((servant) => servant.id)).size !==
    catalog.servants.length
  )
    return { ok: false, reason: 'duplicate servant id' }
  if (
    new Set(catalog.items.map((item) => item.id)).size !== catalog.items.length
  )
    return { ok: false, reason: 'duplicate item id' }
  const essenceError = bondUpCraftEssencesError(catalog)
  if (essenceError) return { ok: false, reason: essenceError }
  const itemIds = new Set(catalog.items.map((item) => item.id))
  const materialError = validateMaterials(catalog, itemIds)
  if (materialError) return { ok: false, reason: materialError }
  const shrinkError = previous && previousCatalogError(catalog, previous)
  if (shrinkError) return { ok: false, reason: shrinkError }
  if (
    new TextEncoder().encode(JSON.stringify(catalog)).byteLength >
    MATERIAL_CATALOG_MAX_BYTES
  )
    return { ok: false, reason: 'catalog exceeds size limit' }
  return { ok: true }
}
