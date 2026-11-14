/**
 * 交換所のエントリーを対価の通貨ごとにまとめ、通貨ごとの全交換に要る合計を出す純粋関数。
 */
import type { EventShopItem } from './master-data/types'
import { itemWantKey } from './item-want-setting'

/**
 * 「欲しい／いらない」の設定のキー。アイテムの品目は番号の文字列、サーヴァント扱いの品目は `svt:<番号>`
 * （番号が同じアイテムの品目と取り違えないため）。
 */
export const shopWantedKey = (item: Pick<EventShopItem, 'itemId' | 'kind'>): string =>
  item.kind === 'svt' ? `svt:${item.itemId}` : itemWantKey(item.itemId)

/** 品目ごとの交換回数。キーは交換所の配列の添字。 */
export type ShopExchangeCounts = ReadonlyMap<number, number>

/** 品目ごとの残り（ゲームの交換所の画面の「残り N回」。0 は売り切れ）。キーは交換所の配列の添字で、無い品目は残りが無い。 */
export type ShopRemaining = ReadonlyMap<number, number>

const NO_REMAINING: ShopRemaining = new Map()

/**
 * 品目の効く上限。在庫上限の無い品目は undefined（上限なし）、残りのある品目は在庫上限と残りの小さいほう（0 を含む）。
 * 在庫上限 0 は上限なしだが残り 0 は売り切れなので、上限なしと回数を同じ数の 0 で表さない。
 */
export const effectiveLimit = (item: Pick<EventShopItem, 'limitNum'>, remaining?: number): number | undefined => {
  if (item.limitNum <= 0) return undefined
  return remaining === undefined ? item.limitNum : Math.max(0, Math.min(item.limitNum, remaining))
}

/** 交換所の配列の添字 `index` の品目の効く上限。 */
const effectiveLimitAt = (
  item: Pick<EventShopItem, 'limitNum'>,
  index: number,
  remaining: ShopRemaining,
): number | undefined => effectiveLimit(item, remaining.get(index))

export interface ShopCurrencyGroup {
  costItemId: number
  /** 対価の通貨の表示名。どのエントリーにも無ければ undefined（旧 KV データ）。 */
  costName?: string
  costIcon?: string
  /** 在庫上限のある品目をすべて交換するのに要る通貨の合計（`costAmount × 効く上限` の和）。 */
  totalCost: number
  /** 在庫上限の無い（`limitNum` が 0 の）品目の数。合計には含めない。売り切れの品目は数えない。 */
  unlimitedCount: number
  items: EventShopItem[]
}

/** 通貨は最初に現れた順、品目は元の順で返す。残りのある品目は効く上限で合計する。 */
export const groupShopByCurrency = (
  shop: EventShopItem[],
  remaining: ShopRemaining = NO_REMAINING,
): ShopCurrencyGroup[] => {
  const groups = new Map<number, ShopCurrencyGroup>()
  shop.forEach((item, index) => {
    let group = groups.get(item.costItemId)
    if (!group) {
      group = { costItemId: item.costItemId, totalCost: 0, unlimitedCount: 0, items: [] }
      groups.set(item.costItemId, group)
    }
    group.costName ??= item.costName
    group.costIcon ??= item.costIcon
    const limit = effectiveLimitAt(item, index, remaining)
    if (limit !== undefined) group.totalCost += item.costAmount * limit
    else group.unlimitedCount += 1
    group.items.push(item)
  })
  return [...groups.values()]
}

const NO_KEYS: ReadonlySet<string> = new Set()

/** 入れた回数を0以上の整数にし、上限（undefined は上限なし）で頭打ちにする。 */
const clampToLimit = (count: number, limit: number | undefined): number => {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return limit === undefined ? n : Math.min(n, limit)
}

/**
 * 入れた回数を0以上の整数にし、在庫上限のある品目は上限で頭打ちにする。
 * `remaining` を渡すと効く上限（在庫上限と残りの小さいほう）で頭打ちにする。
 */
export const clampExchangeCount = (item: Pick<EventShopItem, 'limitNum'>, count: number, remaining?: number): number =>
  clampToLimit(count, effectiveLimit(item, remaining))

export interface ShopCurrencyNeed {
  costItemId: number
  /** 選んだ交換の対価の合計。 */
  selectedCost: number
  /** 対価の合計から所持数を引いた量（0未満は0）。 */
  need: number
}

/** 通貨ごとに選んだ交換の対価の合計と必要量を出す。通貨は交換所に最初に現れた順。 */
export const computeShopCurrencyNeeds = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  owned: ReadonlyMap<number, number>,
  remaining: ShopRemaining = NO_REMAINING,
): ShopCurrencyNeed[] => {
  const costs = new Map<number, number>()
  shop.forEach((item, index) => {
    const count = clampExchangeCount(item, counts.get(index) ?? 0, remaining.get(index))
    costs.set(item.costItemId, (costs.get(item.costItemId) ?? 0) + item.costAmount * count)
  })
  return [...costs].map(([costItemId, selectedCost]) => ({
    costItemId,
    selectedCost,
    need: Math.max(0, selectedCost - Math.max(0, owned.get(costItemId) ?? 0)),
  }))
}

/**
 * その通貨で在庫上限のある「欲しい」の品目をすべて効く上限の回数にした回数を返す（売り切れの品目は 0）。
 * 上限の無い品目と「いらない」の品目（`unwanted` に `shopWantedKey` が入る品目）は変えない。
 */
export const selectAllUpToLimit = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  costItemId: number,
  unwanted: ReadonlySet<string> = NO_KEYS,
  remaining: ShopRemaining = NO_REMAINING,
): Map<number, number> => {
  const next = new Map(counts)
  shop.forEach((item, index) => {
    const limit = effectiveLimitAt(item, index, remaining)
    if (item.costItemId === costItemId && limit !== undefined && !unwanted.has(shopWantedKey(item))) {
      next.set(index, limit)
    }
  })
  return next
}

/** 交換所のすべての通貨で、在庫上限のある「欲しい」の品目をすべて効く上限の回数にした回数を返す。上限の無い品目と「いらない」の品目は変えない。 */
export const selectAllCurrenciesUpToLimit = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  unwanted: ReadonlySet<string> = NO_KEYS,
  remaining: ShopRemaining = NO_REMAINING,
): Map<number, number> => {
  let next = new Map(counts)
  for (const costItemId of new Set(shop.map(item => item.costItemId))) {
    next = selectAllUpToLimit(shop, next, costItemId, unwanted, remaining)
  }
  return next
}

/** 「いらない」の品目の回数を除いた回数（計算に使う）。保存値の回数は消さないので、計算に渡す前にだけ使う。 */
export const excludeUnwantedCounts = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  unwanted: ReadonlySet<string>,
): ShopExchangeCounts => {
  if (unwanted.size === 0) return counts
  const next = new Map(counts)
  shop.forEach((item, index) => {
    if (unwanted.has(shopWantedKey(item))) next.delete(index)
  })
  return next
}

/**
 * 交換所の一覧の1行。複数の通貨で交換できる品目をまとめた行は品目を2つ以上持つ。
 * `indices` は交換所の配列の添字（交換所の順）、`items` はその添字の品目。
 */
export interface ShopListRow {
  indices: number[]
  items: EventShopItem[]
}

/** まとめる組のキー（獲得物の種類・番号・1回の個数）。 */
const mergeGroupKey = (item: EventShopItem): string =>
  [item.kind === 'svt' ? 'svt' : 'item', item.itemId, item.qty].join(':')

/**
 * 交換所の品目から一覧の行を作る（交換所の順。まとめた行はまとめた品目のうち最初の品目の位置）。
 * 獲得物の種類・番号・1回の個数が同じ品目の組が2つ以上の品目からなり、どの品目も在庫上限を持ち、
 * 通貨がすべて異なるときだけ、その組を1行にまとめる。条件に合わない組はどの品目もまとめない。
 */
export const buildShopListRows = (shop: EventShopItem[]): ShopListRow[] => {
  const groups = new Map<string, { index: number; item: EventShopItem }[]>()
  shop.forEach((item, index) => {
    const key = mergeGroupKey(item)
    groups.set(key, [...(groups.get(key) ?? []), { index, item }])
  })
  const mergeable = (members: { item: EventShopItem }[]): boolean =>
    members.length >= 2 &&
    members.every(m => m.item.limitNum > 0) &&
    new Set(members.map(m => m.item.costItemId)).size === members.length
  const rows: ShopListRow[] = []
  shop.forEach((item, index) => {
    const members = groups.get(mergeGroupKey(item)) ?? []
    if (!mergeable(members)) rows.push({ indices: [index], items: [item] })
    else if (members[0]?.index === index) {
      rows.push({ indices: members.map(m => m.index), items: members.map(m => m.item) })
    }
  })
  return rows
}

/** 行の品目と、その交換所の配列の添字の組（交換所の順）。 */
export const shopRowEntries = (row: ShopListRow): { index: number; item: EventShopItem }[] =>
  row.items.flatMap((item, k) => {
    const index = row.indices.at(k)
    return index === undefined ? [] : [{ index, item }]
  })

/**
 * 行に入れた回数を、行の品目ごとの交換回数に分ける（キーは交換所の配列の添字）。
 * 回数は 0 以上の整数にし、行の効く上限の合計で頭打ちにする。品目を交換所の順に見て、前の品目から効く上限まで埋める。
 * 在庫上限の無い品目（まとめない行）は入れた回数をそのまま使う。
 */
export const splitRowCount = (
  row: ShopListRow,
  count: number,
  remaining: ShopRemaining = NO_REMAINING,
): Map<number, number> => {
  const result = new Map<number, number>()
  const entries = shopRowEntries(row)
  const [single] = entries
  if (entries.length === 1 && single) {
    result.set(single.index, clampExchangeCount(single.item, count, remaining.get(single.index)))
    return result
  }
  const limited = entries.map(({ index, item }) => ({ index, limit: effectiveLimitAt(item, index, remaining) ?? 0 }))
  let left = clampToLimit(count, limited.reduce((acc, { limit }) => acc + limit, 0))
  for (const { index, limit } of limited) {
    const n = Math.min(left, limit)
    result.set(index, n)
    left -= n
  }
  return result
}

/** 行の効く上限の合計。在庫上限の無い品目を含む行は undefined（上限なし）。品目がすべて売り切れの行は 0。 */
export const rowLimit = (row: ShopListRow, remaining: ShopRemaining = NO_REMAINING): number | undefined => {
  let total = 0
  for (const { index, item } of shopRowEntries(row)) {
    const limit = effectiveLimitAt(item, index, remaining)
    if (limit === undefined) return undefined
    total += limit
  }
  return total
}

export interface ShopRowCountPart {
  index: number
  costItemId: number
  costName?: string
  costIcon?: string
  count: number
}

/** 行の今の回数（品目ごとの回数の合計）と、回数が 1 以上の品目ごとの内訳（交換所の順）。 */
export const rowCountOf = (
  row: ShopListRow,
  counts: ShopExchangeCounts,
  remaining: ShopRemaining = NO_REMAINING,
): { count: number; parts: ShopRowCountPart[] } => {
  const parts = shopRowEntries(row).map(({ index, item }) => ({
    index,
    costItemId: item.costItemId,
    ...(item.costName !== undefined ? { costName: item.costName } : {}),
    ...(item.costIcon !== undefined ? { costIcon: item.costIcon } : {}),
    count: clampExchangeCount(item, counts.get(index) ?? 0, remaining.get(index)),
  }))
  return { count: parts.reduce((acc, p) => acc + p.count, 0), parts: parts.filter(p => p.count > 0) }
}

export interface RankedShopRow {
  row: ShopListRow
  /** 1からの順位。 */
  rank: number
  /** 通貨1個あたりの AP 換算値（行の品目の `qty × AP 換算値 ÷ costAmount` のうち最も高い値）。 */
  efficiency: number
}

export interface ShopEfficiencyOrder {
  /** 効率のある行（効率の高い順、同じ効率は交換所の順）。 */
  ranked: RankedShopRow[]
  /** 効率の無い行（交換所の順）。 */
  unpriced: ShopListRow[]
}

/** 品目の効率。サーヴァント扱い・AP 換算値の無い品目・対価 0 以下は undefined。 */
const itemEfficiency = (item: EventShopItem, prices: ReadonlyMap<number, number>): number | undefined => {
  // サーヴァント扱いの品目はドロップ表に現れないので、同じ番号のアイテムの価格を引かない。
  const price = item.kind === 'svt' ? undefined : prices.get(item.itemId)
  if (price === undefined || price <= 0 || item.costAmount <= 0) return undefined
  return (item.qty * price) / item.costAmount
}

/**
 * 一覧の行（交換所の順）を、通貨をまたいだ1つの一覧として、効率のある行（効率の高い順に 1 からの順位）と
 * 効率の無い行（交換所の順）に分ける。`apPrices` は atlasId → 素材1個の AP 換算値。
 */
export const orderShopByEfficiency = (
  rows: ShopListRow[],
  apPrices: Readonly<Record<number, number>>,
): ShopEfficiencyOrder => {
  const prices = new Map(Object.entries(apPrices).map(([id, price]) => [Number(id), price]))
  const unpriced: ShopListRow[] = []
  const priced: { row: ShopListRow; efficiency: number }[] = []
  for (const row of rows) {
    const values = row.items.flatMap(item => {
      const value = itemEfficiency(item, prices)
      return value === undefined ? [] : [value]
    })
    if (values.length === 0) unpriced.push(row)
    else priced.push({ row, efficiency: Math.max(...values) })
  }
  // Array.prototype.sort は安定ソートなので、同じ効率の行は交換所の順のまま。
  priced.sort((a, b) => b.efficiency - a.efficiency)
  const ranked = priced.map((entry, i) => ({ ...entry, rank: i + 1 }))
  return { ranked, unpriced }
}

/** 効率の表示。小数2桁までにし、末尾の0は出さない。 */
export const formatEfficiency = (value: number): string => String(Math.round(value * 100) / 100)

/** QP の atlasId。交換所の QP で育成計画の QP を埋める使い方は想定しないので、要る・要らないの対象から外す。 */
export const QP_ITEM_ID = 1

/** 伝承結晶の atlasId。育成計画で扱う素材。 */
const LORE_CRYSTAL_ITEM_ID = 6999

/**
 * 育成計画で扱う素材の一覧を読めなくても、番号で扱いが決まる品目の atlasId（伝承結晶・カルデアの夢火）。
 * ラベルの判定にだけ使い、交換回数の入れ方は変えない。
 */
export const DEFAULT_WANTED_ITEM_IDS: ReadonlySet<number> = new Set([LORE_CRYSTAL_ITEM_ID, 1000])

/** 番号で扱いが決まる品目か。サーヴァント扱いの品目は番号が同じでも含めない。 */
export const isDefaultWanted = (item: Pick<EventShopItem, 'itemId' | 'kind'>): boolean =>
  item.kind !== 'svt' && DEFAULT_WANTED_ITEM_IDS.has(item.itemId)

/** 素材ごとの不足（総必要数 − 所持数、0 未満は 0）。所持数は atlasId の文字列 → 個数。 */
export const computeShopShortfall = (
  totalNeed: ReadonlyMap<number, number>,
  possession: Readonly<Record<string, number | undefined>>,
): Map<number, number> =>
  new Map(
    [...totalNeed].map(([id, need]) => [id, Math.max(0, need - (Number(possession[String(id)]) || 0))]),
  )

/** 育成計画から見た品目の状態。 */
export type ShopItemStatus =
  | { kind: 'enough' }
  | { kind: 'short'; shortfall: number }
  /** 育成計画で扱う素材だが、今の必要数は 0。 */
  | { kind: 'unused' }
  /** 育成計画で扱っていない品目。 */
  | { kind: 'outside' }

/**
 * 品目の状態を決める。QP は状態なし。必要数のある素材は `planItemIds` を見ない。
 * `planItemIds`（育成計画で扱う素材の集合）が undefined なら、必要数 0 の品目は見分けられないので状態なし。
 * ただし番号で扱いが決まる品目は、伝承結晶なら「使わない」、夢火なら「計画の対象外」にする。
 * サーヴァント扱いの品目は育成計画の素材ではないので、番号を突き合わせずに計画の対象外にする。
 */
export const shopItemStatus = (
  item: Pick<EventShopItem, 'itemId' | 'kind'>,
  totalNeed: ReadonlyMap<number, number>,
  shortfall: ReadonlyMap<number, number>,
  planItemIds: ReadonlySet<number> | undefined,
): ShopItemStatus | undefined => {
  if (item.kind === 'svt') return planItemIds ? { kind: 'outside' } : undefined
  const { itemId } = item
  if (itemId === QP_ITEM_ID) return undefined
  if ((totalNeed.get(itemId) ?? 0) > 0) {
    const n = shortfall.get(itemId) ?? 0
    return n > 0 ? { kind: 'short', shortfall: n } : { kind: 'enough' }
  }
  if (!planItemIds) {
    // 伝承結晶と夢火は番号で扱いが決まっているので、一覧が無くても見分けられる。
    if (!isDefaultWanted(item)) return undefined
    return itemId === LORE_CRYSTAL_ITEM_ID ? { kind: 'unused' } : { kind: 'outside' }
  }
  return planItemIds.has(itemId) ? { kind: 'unused' } : { kind: 'outside' }
}

export interface ShortfallAllocation {
  /**
   * 品目ごとの交換回数。キーは交換所の配列の添字で、「欲しい」のすべての品目を持つ。
   * 「いらない」の品目は入力の回数のまま（入力に無ければ持たない）。
   */
  counts: Map<number, number>
  /** 交換所に品目のある不足の素材ごとの、交換所で埋まらない残り（埋まるなら 0）。品目がすべて「いらない」の素材は不足のまま。 */
  remaining: Map<number, number>
  /** 残りのある素材の、「欲しい」の品目のうち交換所の元の順で最後の品目の添字 → 残り。 */
  remainders: Map<number, number>
  /** 在庫上限が無くて回数を入れなかった「欲しい」の計画の対象外の品目の添字。 */
  unlimitedWanted: Set<number>
}

/** 不足のある素材の品目の交換回数。残りの不足 `left` を1回の個数で割って切り上げ、効く上限（undefined は上限なし）で打ち切る。 */
const shortCount = (item: EventShopItem, left: number, limit: number | undefined): number => {
  if (item.qty <= 0 || left <= 0) return 0
  return clampToLimit(Math.ceil(left / item.qty), limit)
}

/**
 * 「足りない分だけ」の回数を出す。「欲しい」の品目だけを置き換え、「いらない」の品目（`unwanted` に `shopWantedKey` が入る品目）は
 * `counts`（今の回数）のまま返す。
 * 不足は交換所の元の順に「欲しい」の品目へ割り当て、効く上限（`itemRemaining` に残りのある品目は在庫上限と残りの小さいほう）で
 * 打ち切る。1回の個数が 0 以下の品目は割り当てない。
 * 状態が「計画の対象外」の品目は、在庫上限があれば効く上限、無ければ 0 にして回数の手入力を促す。
 * 足りている・使わない・状態なし（QP・見分けられない品目）の品目は 0。
 */
export const allocateShortfallOnly = (
  shop: EventShopItem[],
  shortfall: ReadonlyMap<number, number>,
  statusOf: (item: EventShopItem) => ShopItemStatus | undefined,
  unwanted: ReadonlySet<string>,
  counts: ShopExchangeCounts = new Map(),
  itemRemaining: ShopRemaining = NO_REMAINING,
): ShortfallAllocation => {
  const next = new Map<number, number>()
  const remaining = new Map<number, number>()
  const lastIndex = new Map<number, number>()
  const unlimitedWanted = new Set<number>()
  shop.forEach((item, index) => {
    const status = statusOf(item)
    if (unwanted.has(shopWantedKey(item))) {
      const current = counts.get(index)
      if (current !== undefined) next.set(index, current)
      // 回数は入らないので、品目がすべて「いらない」の素材も埋まらない不足として数える。
      if (status?.kind === 'short' && !remaining.has(item.itemId)) {
        remaining.set(item.itemId, shortfall.get(item.itemId) ?? 0)
      }
      return
    }
    next.set(index, 0)
    if (!status) return
    const limit = effectiveLimitAt(item, index, itemRemaining)
    if (status.kind === 'short') {
      lastIndex.set(item.itemId, index)
      const left = remaining.get(item.itemId) ?? shortfall.get(item.itemId) ?? 0
      const count = shortCount(item, left, limit)
      next.set(index, count)
      remaining.set(item.itemId, Math.max(0, left - count * item.qty))
    } else if (status.kind === 'outside' && item.qty > 0) {
      // 売り切れ（効く上限 0）の品目は 0 回で、上限なしの品目として数えない。
      if (limit !== undefined) next.set(index, limit)
      else unlimitedWanted.add(index)
    }
  })
  const remainders = new Map<number, number>()
  for (const [itemId, left] of remaining) {
    const index = lastIndex.get(itemId)
    if (left > 0 && index !== undefined) remainders.set(index, left)
  }
  return { counts: next, remaining, remainders, unlimitedWanted }
}

export interface ShortfallSummary {
  /** 交換所に品目のある不足の素材（QP を除く）の数。 */
  shortMaterials: number
  /** そのうち交換所で埋まる素材の数。 */
  filledMaterials: number
}

export const summarizeShortfall = (allocation: Pick<ShortfallAllocation, 'remaining'>): ShortfallSummary => {
  const lefts = [...allocation.remaining.values()]
  return { shortMaterials: lefts.length, filledMaterials: lefts.filter(left => left === 0).length }
}

/**
 * 交換所の品目ごとに、並びの位置によらない品目キーを返す（配列の添字の順）。
 * キーは `<種類>:<獲得物の番号>:<1回の個数>:<対価の通貨>:<1回の対価>:<同じ組での出現順>`。
 * 在庫上限は組に入れず、取り込み直しで上限だけが変わっても同じ品目として扱う。
 */
export const shopItemKeys = (shop: EventShopItem[]): string[] => {
  const seen = new Map<string, number>()
  return shop.map(item => {
    const base = [item.kind === 'svt' ? 'svt' : 'item', item.itemId, item.qty, item.costItemId, item.costAmount].join(':')
    const order = seen.get(base) ?? 0
    seen.set(base, order + 1)
    return `${base}:${order}`
  })
}

/** 添字のキーの交換回数を、品目キーの表にする。 */
export const countsToItemKeys = (shop: EventShopItem[], counts: ShopExchangeCounts): Record<string, number> => {
  const keys = shopItemKeys(shop)
  return Object.fromEntries(
    [...counts].flatMap(([index, count]) => {
      const key = keys.at(index)
      return key === undefined ? [] : [[key, count]]
    }),
  )
}

/** 品目キーの表を、今の交換所の添字のキーの交換回数にする。今の交換所に無い品目キーは捨て、在庫上限で頭打ちにする。 */
export const countsFromItemKeys = (
  shop: EventShopItem[],
  saved: Readonly<Record<string, number>>,
): Map<number, number> => {
  const counts = new Map<number, number>()
  const savedByKey = new Map(Object.entries(saved))
  const keys = shopItemKeys(shop)
  shop.forEach((item, index) => {
    const key = keys.at(index)
    const count = key === undefined ? undefined : savedByKey.get(key)
    if (count !== undefined) counts.set(index, clampExchangeCount(item, count))
  })
  return counts
}

/**
 * 品目キーの残りの表を、今の交換所の添字のキーの残りにする（交換回数と同じ読み替え）。今の交換所に無い品目キーは捨てる。
 * 残りは保存値の交換回数と違い頭打ちにしない（在庫上限との小さいほうは効く上限で取る）。
 */
export const remainingFromItemKeys = (
  shop: EventShopItem[],
  saved: Readonly<Record<string, number>>,
): Map<number, number> => {
  const remaining = new Map<number, number>()
  const savedByKey = new Map(Object.entries(saved))
  shopItemKeys(shop).forEach((key, index) => {
    const value = savedByKey.get(key)
    if (value !== undefined) remaining.set(index, value)
  })
  return remaining
}

/**
 * 品目キーの残りの表のうち、`values`（交換所の配列の添字 → 残り。undefined は残りを除く）の品目だけを書き換えた表を返す。
 * ほかの品目の残り（今の交換所に無い品目キーを含む）はそのまま残す。
 */
export const withRemainingValues = (
  shop: EventShopItem[],
  saved: Readonly<Record<string, number>>,
  values: ReadonlyMap<number, number | undefined>,
): Record<string, number> => {
  const keys = shopItemKeys(shop)
  const next = new Map(Object.entries(saved))
  for (const [index, value] of values) {
    const key = keys.at(index)
    if (key === undefined) continue
    if (value === undefined) next.delete(key)
    else next.set(key, value)
  }
  return Object.fromEntries(next)
}

/**
 * 利用者が入れた残りを、保存する値にする。小数は切り捨て、在庫上限を超える値は在庫上限にする。
 * 有限の数でない値・負の数・在庫上限の無い品目は残りにしない（undefined）。
 */
export const normalizeRemainingInput = (item: Pick<EventShopItem, 'limitNum'>, value: number): number | undefined => {
  if (!Number.isFinite(value) || value < 0 || item.limitNum <= 0) return undefined
  return Math.min(Math.floor(value), item.limitNum)
}

/**
 * 交換所の周回計算でイベントごとに保存する入力。交換回数は品目キー、所持数とボーナスは通貨・品目の番号がキー。
 * `remaining` は交換回数と同じ品目キーの残り（表に無い品目は残りが無い。0 は売り切れ）。
 * `rarity` はボーナス礼装の ☆ がキーで、凸・無凸の +N と所持枚数の表。
 * `friendRarity` はフレンドの礼装の ☆（`null` は「なし」、無ければ未選択）、`selectedTotal` は比較の表で選んだ行の合計枚数。
 */
export interface ShopSavedInputs {
  counts: Record<string, number>
  owned: Record<string, number>
  bonus: Record<string, number>
  rarity: Record<string, Record<string, number>>
  remaining: Record<string, number>
  friendRarity?: number | null
  selectedTotal?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const countTable = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, n]) =>
      typeof n === 'number' && Number.isFinite(n) ? [[key, Math.max(0, Math.floor(n))]] : [],
    ),
  )
}

/** 残りの表。0 は売り切れなので、有限の数でない値と負の数は 0 にせず表から除く。小数は切り捨てる。 */
const remainingTable = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, n]) =>
      typeof n === 'number' && Number.isFinite(n) && n >= 0 ? [[key, Math.floor(n)]] : [],
    ),
  )
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

/**
 * 保存値を読む。表でなければ空、有限の数でない値は捨て、小数は切り捨て、負の数は 0 にする（残りの負の数は捨てる）。
 * フレンドの ☆ は `null` か 0 以上の整数、選んだ合計枚数は 0 以上の整数のときだけ使い、それ以外は未選択として読む。
 */
export const readShopSavedInputs = (value: unknown): ShopSavedInputs => {
  const record = isRecord(value) ? value : {}
  const rarity = isRecord(record.rarity)
    ? Object.fromEntries(Object.entries(record.rarity).map(([key, table]) => [key, countTable(table)]))
    : {}
  return {
    counts: countTable(record.counts),
    owned: countTable(record.owned),
    bonus: countTable(record.bonus),
    rarity,
    remaining: remainingTable(record.remaining),
    ...(record.friendRarity === null || isCount(record.friendRarity) ? { friendRarity: record.friendRarity } : {}),
    ...(isCount(record.selectedTotal) ? { selectedTotal: record.selectedTotal } : {}),
  }
}

/** 番号がキーの表を、指定した番号だけの表（Map）にする。ほかの番号の値は使わない。 */
export const pickIdTable = (table: Readonly<Record<string, number>>, ids: Iterable<number>): Map<number, number> => {
  const picked = new Map<number, number>()
  const byId = new Map(Object.entries(table))
  for (const id of ids) {
    const value = byId.get(String(id))
    if (value !== undefined) picked.set(id, value)
  }
  return picked
}
