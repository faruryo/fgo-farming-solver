import type { Item as AtlasItem } from '../../interfaces/atlas-academy'
import { toApiItemId } from '../to-api-item-id'

// 短縮IDの世代間安定化（採番の永続化）。
//
// クエスト/アイテムの短縮IDは従来スプレッドシートの並び順から位置ベースで採番されて
// おり、上流にクエスト/エリアが追加されると後続IDが全てずれていた。保存済みの選択
// (localStorage / クラウド同期 / 共有URL) は短縮IDのまま永続化されるため、データ更新で
// 黙って別クエストを指す事故が起きる。本モジュールは前回公開ペイロードに同梱した
// append-only な `id_registry` を引き継ぎ、同一対象には同一IDを割り当て続ける。
//
// - 空レジストリでの実行は現行の位置ベース採番と完全一致する（フォールバック互換）。
// - 削除された対象のIDはレジストリに墓標として残り、恒久的に再利用されない。

export interface QuestIdEntry {
  id: string
  /** aaQuestId（判明している場合）。クエスト名リネーム時のフォールバックマッチに使う。 */
  aa?: number
}

export interface IdRegistry {
  version: 1
  /** エリア名 -> 2文字プレフィックス */
  areas: Record<string, string>
  /** "エリア名\tクエスト名" -> entry（append-only） */
  quests: Record<string, QuestIdEntry>
  /** String(atlasId) -> 短縮アイテムID（append-only） */
  items: Record<string, string>
}

/** レジストリ合成・参照に使う最小限の構造型（types.ts との循環 import を避ける）。 */
type RegistryQuest = {
  area: string
  name: string
  id: string
  section: string
  aaQuestId?: number
}
type RegistryItem = { id: string; atlasId?: number }

export type PreviousMasterData = {
  quests?: RegistryQuest[]
  items?: RegistryItem[]
  id_registry?: IdRegistry
}

export const questKey = (area: string, name: string): string => `${area}\t${name}`

export const emptyRegistry = (): IdRegistry => ({
  version: 1,
  areas: {},
  quests: {},
  items: {},
})

/**
 * 前回公開ペイロードからレジストリを復元する。
 * - `id_registry` があればそれを採用（deep clone して呼び出し側で安全に追記できるようにする）。
 * - 無い場合（移行初回）は公開済み quests / items から合成し、現在公開中の全IDをピン留めする。
 * - 前回データ自体が無い/壊れている場合は空レジストリ（= 位置ベース採番と完全一致）。
 */
export const registryFromPrevious = (
  previous?: PreviousMasterData | null
): IdRegistry => {
  if (!previous) return emptyRegistry()
  const prior = previous.id_registry
  if (prior && prior.version === 1) {
    return {
      version: 1,
      areas: { ...prior.areas },
      quests: Object.fromEntries(
        Object.entries(prior.quests ?? {}).map(([k, v]) => [k, { ...v }])
      ),
      items: { ...(prior.items ?? {}) },
    }
  }
  const registry = emptyRegistry()
  for (const q of previous.quests ?? []) {
    if (typeof q.id !== 'string' || q.id.length < 3) continue
    registry.areas[q.area] = q.id.slice(0, 2)
    registry.quests[questKey(q.area, q.name)] =
      q.aaQuestId != null ? { id: q.id, aa: q.aaQuestId } : { id: q.id }
  }
  for (const it of previous.items ?? []) {
    if (typeof it.atlasId === 'number' && it.id) {
      registry.items[String(it.atlasId)] = it.id
    }
  }
  return registry
}

const isDailyPrefix = (prefix: string): boolean => prefix[0] === '0'

/**
 * クエスト短縮IDを割り当てる。registry は in-place で追記される（append-only）。
 * @param quests 変換途中のクエスト（id は `エリア_クエスト名` 形式の long ID）
 * @returns long ID -> 短縮ID のマッピング
 */
export const assignQuestIds = (
  quests: RegistryQuest[],
  registry: IdRegistry
): Map<string, string> => {
  // レジストリから使用済みプレフィックス / aa 逆引き / プレフィックス毎の最大 index を構築。
  // プレフィックスは areas だけでなく墓標クエストの id からも回収し、
  // エリア改名で areas から外れたプレフィックスが新エリアに再利用されるのを防ぐ。
  const usedPrefixes = new Set<string>(Object.values(registry.areas))
  const byAa = new Map<number, { key: string; entry: QuestIdEntry }>()
  const maxIndex = new Map<string, number>()
  for (const [key, entry] of Object.entries(registry.quests)) {
    const prefix = entry.id.slice(0, 2)
    usedPrefixes.add(prefix)
    const idx = parseInt(entry.id.slice(2), 36)
    if (Number.isFinite(idx)) {
      maxIndex.set(prefix, Math.max(maxIndex.get(prefix) ?? -1, idx))
    }
    if (entry.aa != null && !byAa.has(entry.aa)) byAa.set(entry.aa, { key, entry })
  }

  // エリアプレフィックス解決。Daily（sorted）→ Free（sorted）の順に処理することで、
  // 空レジストリ時は現行の位置ベース採番と完全一致する。
  const nextUnusedPrefix = (daily: boolean): string => {
    if (daily) {
      // Daily: '00'..'0z'
      for (let c = 0; c < 36; c++) {
        const p = '0' + c.toString(36)
        if (!usedPrefixes.has(p)) return p
      }
    } else {
      // Free: '10'..'zz'（'0' 始まりは Daily 専用なのでスキップ）
      for (let a = 1; a < 36; a++) {
        for (let b = 0; b < 36; b++) {
          const p = a.toString(36) + b.toString(36)
          if (!usedPrefixes.has(p)) return p
        }
      }
    }
    throw new Error('No unused area prefix available')
  }

  const areaPrefix = new Map<string, string>()
  const resolveArea = (area: string, daily: boolean) => {
    const known = registry.areas[area]
    // セクション不整合プレフィックス（Daily ⇔ '0' 始まり）は再利用しない
    if (known && isDailyPrefix(known) === daily) {
      areaPrefix.set(area, known)
      return
    }
    const p = nextUnusedPrefix(daily)
    usedPrefixes.add(p)
    areaPrefix.set(area, p)
    registry.areas[area] = p
  }
  const dailyAreas = [...new Set(quests.filter(q => q.section === 'Daily').map(q => q.area))].sort()
  const freeAreas = [...new Set(quests.filter(q => q.section !== 'Daily').map(q => q.area))].sort()
  dailyAreas.forEach(a => resolveArea(a, true))
  freeAreas.forEach(a => resolveArea(a, false))

  // 今世代に存在するキーの集合。aa フォールバックは「旧名のクエストが消えている」
  // 真のリネーム時のみ発動させる。スプレッドシート→Atlas の名前マッチは曖昧で、
  // 異なるクエストに同一 aaQuestId が振られることがあり（実例: アヴァロンの
  // ノリッジ/キャメロット）、無条件の aa 一致は現存クエストのIDを新規クエストが
  // 奪って重複IDを生む。
  const currentKeys = new Set(quests.map(q => questKey(q.area, q.name)))

  const mapping = new Map<string, string>()
  const assignedIds = new Set<string>()
  for (const q of quests) {
    const prefix = areaPrefix.get(q.area) as string
    const key = questKey(q.area, q.name)
    // 第一キー: エリア名+クエスト名。フォールバック: aaQuestId（リネーム耐性）
    let entry: QuestIdEntry | undefined = registry.quests[key]
    if (!entry && q.aaQuestId != null) {
      const aaHit = byAa.get(q.aaQuestId)
      // 旧キーが今世代にも現存するなら、それはリネームではなく aa の衝突 → 新規採番
      if (aaHit && !currentKeys.has(aaHit.key)) entry = aaHit.entry
    }

    let shortId: string
    if (entry && entry.id.slice(0, 2) === prefix && !assignedIds.has(entry.id)) {
      // エリア移動/改名クエストが旧プレフィックスを持ち込んでツリーが分裂するのを防ぐため、
      // 現エリアプレフィックスで始まる場合のみ再利用する。今世代内で割当済みのIDも
      // 再利用しない（重複IDの最終ガード）。
      shortId = entry.id
    } else {
      // 新規採番は最小空きではなく max+1（墓標のIDを再利用しない）
      const idx = (maxIndex.get(prefix) ?? -1) + 1
      maxIndex.set(prefix, idx)
      shortId = prefix + idx.toString(36)
    }

    // レジストリへ追記。aa 一致で新キーになった場合、旧キーは無害な墓標として残る。
    const newEntry: QuestIdEntry =
      q.aaQuestId != null ? { id: shortId, aa: q.aaQuestId } : { id: shortId }
    registry.quests[key] = newEntry
    if (q.aaQuestId != null && !byAa.has(q.aaQuestId)) {
      byAa.set(q.aaQuestId, { key, entry: newEntry })
    }
    assignedIds.add(shortId)
    mapping.set(q.id, shortId)
  }
  return mapping
}

/**
 * アイテム短縮IDを割り当てる。registry は in-place で追記される（append-only）。
 * - atlasId がレジストリに登録済みなら再利用。
 * - 未登録なら位置ベース候補（toApiItemId）。別 atlasId に割当済みなら
 *   同一 intercept 空間の maxIndex+1 で衝突回避。
 * - 採番対象外アイテム（intercept 無し）は `''` を返す。
 */
export const assignItemId = (
  item: AtlasItem,
  itemsForPositional: AtlasItem[],
  registry: IdRegistry
): string => {
  const known = registry.items[String(item.id)]
  if (known) return known

  const positional = toApiItemId(item, itemsForPositional)
  if (!positional) return ''

  let id = positional
  const used = new Set(Object.values(registry.items))
  if (used.has(positional)) {
    const intercept = positional[0]
    let max = -1
    for (const v of used) {
      if (v[0] !== intercept) continue
      const idx = parseInt(v.slice(1), 36)
      if (Number.isFinite(idx) && idx > max) max = idx
    }
    id = intercept + (max + 1).toString(36)
  }
  registry.items[String(item.id)] = id
  return id
}
