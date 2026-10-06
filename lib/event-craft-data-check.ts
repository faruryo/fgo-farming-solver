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

const DROP_BACKGROUNDS = new Set(['bronze', 'silver', 'gold'])
// Atlas の priority: スキル石・強化素材は 299 未満。伝承結晶(6999)は 299 で skillLvUp/gold だが
// フリクエで周回できず、過去イベントの特殊再臨素材は 500 以上でカタログ外が正当。
const MAX_FARMABLE_PRIORITY = 298

const isFarmableClass = (atlas: AtlasItemLike | undefined): boolean =>
  atlas?.type === 'skillLvUp' &&
  DROP_BACKGROUNDS.has(atlas.background) &&
  (atlas.priority ?? 0) <= MAX_FARMABLE_PRIORITY

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
 * 欠落した atlasId を返す(空なら完全)。
 * (a) ドロップ周回対象クラス(skillLvUp・銅銀金・priority 298 以下)なのに drops カタログに無い。
 * (b) カタログにあるが有効なドロップ行(drop_rate > 0 かつ既知クエスト)が無い。周回対象クラスは
 *     常に欠落。それ以外は同 category の他アイテムには有る場合のみ欠落(カテゴリごと恒常ドロップ無しは正当)。
 */
export const findMissingCraftData = (
  drops: Pick<Drops, 'items' | 'quests' | 'drop_rates'>,
  needAtlasIds: Iterable<number>,
  items: AtlasItemLike[],
): number[] => {
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

  const missing: number[] = []
  for (const atlasId of needAtlasIds) {
    const dropItem = dropByAtlasId.get(atlasId)
    const farmable = isFarmableClass(atlasById.get(atlasId))
    if (!dropItem) {
      if (farmable) missing.push(atlasId)
      continue
    }
    if (ratedIds.has(dropItem.id)) continue
    // 周回対象クラスはカテゴリを問わず必ずドロップ率を持つ。それ以外(ピース等)はカテゴリごと
    // 恒常ドロップ無しが正当なので、同カテゴリの他素材にだけ有る場合に限り欠落とみなす。
    if (farmable || ratedCategories.has(dropItem.category)) missing.push(atlasId)
  }
  return missing
}
