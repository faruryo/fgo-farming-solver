/**
 * lib/event-craft-data-check.ts
 *
 * 料理作成の配分計算前に、正の need を持つ素材のドロップデータ欠落を検出する。
 * 配分ソルバーはアカウント全体の残余周回で限界削減量を評価するため、need が黙って
 * 落ちると削減周回/AP が過大に出る。
 */

import type { Drops } from './get-drops'
import type { EnrichedItem } from './get-items'
import { computeFiniteTarget, type StockBuffer } from './quest-efficiency'
import { toStockItemLike } from './farming/build-solve-params'

type AtlasItemLike = Pick<EnrichedItem, 'id' | 'type' | 'background' | 'category' | 'largeCategory' | 'priority'>
type NamedAtlasItem = AtlasItemLike & { name?: string }
type DropTables = Pick<Drops, 'items' | 'quests' | 'drop_rates'>

const DROP_BACKGROUNDS = new Set(['bronze', 'silver', 'gold'])
// Atlas の priority: スキル石・強化素材は 299 未満。伝承結晶(6999)は 299 で skillLvUp/gold だが
// フリクエで周回できず、過去イベントの特殊再臨素材は 500 以上でカタログ外が正当。
const MAX_FARMABLE_PRIORITY = 298

const isFarmableClass = (atlas: AtlasItemLike | undefined): boolean =>
  atlas?.type === 'skillLvUp' &&
  DROP_BACKGROUNDS.has(atlas.background) &&
  (atlas.priority ?? 0) <= MAX_FARMABLE_PRIORITY

export type CraftDataGapReason = 'absent' | 'unrated'

export type CraftDataGap = {
  atlasId: number
  reason: CraftDataGapReason
}

/**
 * 実効不足が正になる atlasId。`buildNeedByApiItemId` と同じ定義を Atlas 側
 * (drops カタログに無い素材も含む)で評価する。
 */
export const positiveNeedAtlasIds = (
  items: AtlasItemLike[],
  amounts: Record<string, number>,
  possession: Record<string, number | undefined>,
  stockBuffer: StockBuffer,
  purpose: 'training' | 'reserve',
): Set<number> => {
  const ids = new Set<number>()
  const itemById = new Map(items.map((it) => [String(it.id), it]))
  const keys = new Set([...itemById.keys(), ...Object.keys(amounts)])
  for (const key of keys) {
    if (purpose === 'reserve' && !(key in possession)) continue
    const required = Reflect.get(amounts, key) ?? 0
    const item = itemById.get(key)
    const target = item
      ? computeFiniteTarget(toStockItemLike(item), required, stockBuffer, purpose)
      : required
    if (target - (Reflect.get(possession, key) ?? 0) > 0) ids.add(Number(key))
  }
  return ids
}

/**
 * 欠落した素材を返す(空なら完全)。
 * (a) `absent`: ドロップ周回対象クラス(skillLvUp・銅銀金・priority 298 以下)なのに drops カタログに無い。
 * (b) `unrated`: カタログにあるが有効なドロップ行(drop_rate > 0 かつ既知クエスト)が無い。周回対象クラスは
 *     常に欠落。それ以外は同 category の他アイテムには有る場合のみ欠落(カテゴリごと恒常ドロップ無しは正当)。
 */
export const findMissingCraftData = (
  drops: DropTables,
  needAtlasIds: Iterable<number>,
  items: AtlasItemLike[],
): CraftDataGap[] => {
  const atlasById = new Map(items.map((it) => [it.id, it]))
  const dropByAtlasId = new Map(
    drops.items.filter((it) => it.atlasId != null).map((it) => [it.atlasId, it]),
  )
  const questIds = new Set(drops.quests.map((q) => q.id))
  const ratedIds = new Set(
    drops.drop_rates
      .filter((r) => r.drop_rate > 0 && questIds.has(r.quest_id))
      .map((r) => r.item_id),
  )
  const ratedCategories = new Set(
    drops.items.filter((it) => ratedIds.has(it.id)).map((it) => it.category),
  )

  const missing: CraftDataGap[] = []
  for (const atlasId of needAtlasIds) {
    const dropItem = dropByAtlasId.get(atlasId)
    const atlas = atlasById.get(atlasId)
    const farmable = isFarmableClass(atlas)
    if (!dropItem) {
      // Atlas 一覧はキャッシュ経由、サーヴァント素材は都度取得なので、新素材は一覧より先に need に現れうる。
      // 分類できない素材は黙って need から落とさず欠落として止める。
      if (!atlas || farmable) missing.push({ atlasId, reason: 'absent' })
      continue
    }
    if (ratedIds.has(dropItem.id)) continue
    // 周回対象クラスはカテゴリを問わず必ずドロップ率を持つ。それ以外(ピース等)はカテゴリごと
    // 恒常ドロップ無しが正当なので、同カテゴリの他素材にだけ有る場合に限り欠落とみなす。
    if (farmable || ratedCategories.has(dropItem.category)) missing.push({ atlasId, reason: 'unrated' })
  }
  return missing
}

export type CraftAuditRow = CraftDataGap & { name: string }

/** 周回対象クラスの全件を欠落判定にかける。点検スクリプト用。 */
export const auditFarmableCraftGaps = (
  drops: DropTables,
  items: NamedAtlasItem[],
): CraftAuditRow[] => {
  const nameById = new Map(items.map((it) => [it.id, it.name ?? '']))
  return findMissingCraftData(
    drops,
    items.filter(isFarmableClass).map((it) => it.id),
    items,
  ).map((gap) => ({ ...gap, name: nameById.get(gap.atlasId) ?? '' }))
}

export const formatFarmableCraftAudit = (rows: CraftAuditRow[]): { exitCode: 0 | 1; text: string } => {
  if (rows.length === 0) return { exitCode: 0, text: 'gaps=0' }
  const lines = rows.map((row) => `${row.atlasId}\t${row.name}\t${row.reason}`)
  return { exitCode: 1, text: [`gaps=${rows.length}`, ...lines].join('\n') }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const unknownRows = (value: unknown): readonly unknown[] | null => {
  if (!Array.isArray(value)) return null
  return Array.from(value, (row: unknown) => row)
}

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const isBackground = (value: unknown): value is AtlasItemLike['background'] =>
  value === 'zero' || value === 'bronze' || value === 'silver' || value === 'gold' || value === 'questClearQPReward'

const mapRows = <T>(rows: readonly unknown[], map: (row: Record<string, unknown>) => T | null): T[] | null => {
  const out: T[] = []
  for (const row of rows) {
    if (!isRecord(row)) return null
    const parsed = map(row)
    if (!parsed) return null
    out.push(parsed)
  }
  return out
}

const parseNamedAtlasItem = (row: Record<string, unknown>): NamedAtlasItem | null => {
  const type = asString(row.type)
  if (typeof row.id !== 'number' || !type || !isBackground(row.background) || typeof row.priority !== 'number') {
    return null
  }
  return {
    id: row.id,
    name: asString(row.name) ?? undefined,
    type,
    background: row.background,
    category: asString(row.category) ?? '',
    largeCategory: asString(row.largeCategory) ?? '',
    priority: row.priority,
  }
}

const parseDropItem = (row: Record<string, unknown>) => {
  const id = asString(row.id)
  const category = asString(row.category)
  if (!id || category === null) return null
  return {
    id,
    atlasId: typeof row.atlasId === 'number' ? row.atlasId : null,
    category,
    largeCategory: asString(row.largeCategory) ?? '',
  }
}

const parseQuest = (row: Record<string, unknown>) => {
  const id = asString(row.id)
  return id ? { id } : null
}

const parseRate = (row: Record<string, unknown>) => {
  const questId = asString(row.quest_id)
  const itemId = asString(row.item_id)
  if (!questId || !itemId || typeof row.drop_rate !== 'number') return null
  return { quest_id: questId, item_id: itemId, drop_rate: row.drop_rate }
}

export const parseCraftAuditInputs = (
  dropsValue: unknown,
  itemsValue: unknown,
): { drops: DropTables; items: NamedAtlasItem[] } | null => {
  if (!isRecord(dropsValue)) return null
  const dropItems = unknownRows(dropsValue.items)
  const questRows = unknownRows(dropsValue.quests)
  const rateRows = unknownRows(dropsValue.drop_rates)
  const atlasRows = unknownRows(itemsValue)
  if (!dropItems || !questRows || !rateRows || !atlasRows || atlasRows.length === 0) return null
  const items = mapRows(atlasRows, parseNamedAtlasItem)
  const parsedItems = mapRows(dropItems, parseDropItem)
  const quests = mapRows(questRows, parseQuest)
  const dropRates = mapRows(rateRows, parseRate)
  if (!items || !parsedItems || !quests || !dropRates) return null
  return { drops: { items: parsedItems, quests, drop_rates: dropRates } as DropTables, items }
}
