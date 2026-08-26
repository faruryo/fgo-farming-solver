import { origin, region } from '../../constants/atlasacademy'
import { Item as AtlasItem } from '../../interfaces/atlas-academy'
import { assignItemId, assignQuestIds, questKey, registryFromPrevious } from './stable-ids'
import type { PreviousMasterData } from './stable-ids'
import { populateWaveCounts } from './wave-count'
import { normalizeItemName, getCategory } from './item-naming'
import { loadNiceWarQuests, type NiceWarCache, type NiceWarQuest } from './nice-war-source'
import { fetchActiveEvents, extractApCampaigns, type AtlasEvent } from './atlas-events'
import { filterCandidateQuests } from './quest-selection'
import type {
  Item,
  Quest,
  DropRate,
  Campaign,
  MasterData,
} from './types'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQerC77YrlI1wQaJHUlDl3VBNh3zx6YDWbF8syDM3DsoG3npubnlG68VY9GlYwRAiP5RCOqQEHZoF4c/pub?gid=1085791724&output=csv'

type AAItem = Pick<AtlasItem, 'id' | 'name' | 'background' | 'priority' | 'icon'> & { type: string }

export interface FetchAndTransformDataOptions {
  events?: AtlasEvent[]
  waveCountSeed?: Map<number, number>
  waveCountMaxFetch?: number
  niceWarCache?: NiceWarCache
  /**
   * 前回公開済みペイロード。短縮IDの世代間安定化（採番の永続化）に使う。
   * 未指定/不正時は空レジストリ = 現行の位置ベース採番と完全一致。
   */
  previous?: PreviousMasterData
}

export async function fetchAndTransformData(
  opts: FetchAndTransformDataOptions = {}
): Promise<MasterData> {
  console.log('Fetching item metadata from Atlas Academy...')
  const itemsResponse = await fetch(`${origin}/export/${region}/nice_item.json`)
  const aaItems: AAItem[] = await itemsResponse.json()
  console.log(`Fetched ${aaItems.length} items from Atlas Academy.`)

  const aaQuests = await loadNiceWarQuests({ niceWarCache: opts.niceWarCache })

  // Use the same type filter and sort order as getLocalItems() so that toApiItemId()
  // produces identical IDs on both the KV-write side and the page-display side.
  const FARMING_ITEM_TYPES = new Set(['qp', 'skillLvUp', 'tdLvUp'])
  const aaItemsForId = aaItems
    .filter(i => FARMING_ITEM_TYPES.has(i.type))
    .sort((a, b) => a.priority - b.priority)

  // 短縮IDの世代間安定化: 前回公開ペイロードの id_registry（無ければ公開済み quests/items
  // から合成）を引き継ぎ、同一対象に同一IDを割り当て続ける。前回データが無い場合は
  // 空レジストリ = 現行の位置ベース採番と完全一致。
  const registry = registryFromPrevious(opts.previous)

  // 2. Fetch Drop Data from Spreadsheet
  console.log('Fetching drop data from spreadsheet...')
  const sheetResponse = await fetch(SHEET_URL)
  const csv = await sheetResponse.text()
  const rows = parseCSV(csv)
  console.log(`Fetched and parsed spreadsheet data: ${rows.length} rows.`)

  // 4. Transform
  const items: Item[] = []
  const quests: Quest[] = []
  const all_drop_rates: DropRate[] = []

  // Item names are in row index 2, starting from column index 4
  const itemNamesInHeader = rows[2].slice(4)

  // 報酬列(基本絆P / EXP / QP)は row index 1 のラベルで位置特定する。
  const rewardHeader = rows[1] ?? []
  const rewardCol = (label: string) => rewardHeader.findIndex(c => (c ?? '').trim() === label)
  const bondCol = rewardCol('基本絆P')
  const expCol = rewardCol('EXP')
  const qpCol = rewardCol('QP')
  const parseReward = (s: string | undefined): number | undefined => {
    const n = parseInt((s ?? '').replace(/,/g, ''), 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  // Create item mapping
  const itemMap = new Map<string, string>()
  for (const shortName of itemNamesInHeader) {
    if (!shortName || shortName === 'AP' || shortName === 'データ数') continue
    
    // Try to find matching AA item
    const fullName = normalizeItemName(shortName)
    let aaItem = aaItems.find(i => i.name === fullName)
    
    // If not found, try substring match (e.g. "蹄鉄" in "隕蹄鉄")
    // Exclude eventItem and high-priority items (priority > 9900 = events, > 399 = non-farmable)
    if (!aaItem) {
      aaItem = aaItems.find(i =>
        i.name.includes(shortName) &&
        (i.type === 'material' || i.type === 'skill' || i.type === 'qp' || i.type === 'skillLvUp') &&
        i.priority < 400
      )
    }

    if (aaItem) {
      // atlasId がレジストリ登録済みなら再利用、新規は getLocalItems() と同じ
      // filtered+sorted リストでの位置ベース候補（衝突時は intercept 空間内 max+1）。
      const id = assignItemId(aaItem as AtlasItem, aaItemsForId as AtlasItem[], registry)
      if (!id) continue
      if (!items.find(i => i.id === id)) {
        const cat = getCategory(aaItem.priority, aaItem.background)
        items.push({
          id,
          category: cat.category,
          largeCategory: cat.largeCategory,
          shortName: shortName,
          name: aaItem.name,
          icon: aaItem.icon,
          // 育成計算機(material/result・所持数)と同じ Atlas ID 空間で連動させる。
          atlasId: aaItem.id,
        })
      }
      itemMap.set(shortName, id)
    }
  }

  // クエストマッチングの高速化: 旧実装はスプレッドシート行ごとに aaQuests 全件
  // (15,000+)を warLongName 条件込みで線形 find しており、これが cron の CPU 主因
  // だった(440行 × 15,675件 ≈ 690万回の文字列比較)。war 条件は warLongName のみに
  // 依存するため、エリアごとに「条件を満たす war の quest 群(元の配列順を保存)」を
  // 一度だけ作り、行ループでは名前条件だけを候補内で find する。
  // filter は順序を保存するので、旧 find(name条件 && war条件) と完全に同じ要素を返す。
  const warNameMatchesArea = (w: string | undefined, area: string): boolean =>
    (w !== undefined &&
      (w.includes(area) ||
        area.includes(w) ||
        (area === '冠位研鑽戦' && w.includes('冠位戴冠戦')))) ||
    (area.includes('修練場') && w === '曜日クエスト')
  const distinctWarNames = [...new Set(aaQuests.map(q => q.warLongName))]
  const areaCandidatesCache = new Map<string, NiceWarQuest[]>()
  const candidatesForArea = (area: string): NiceWarQuest[] => {
    let list = areaCandidatesCache.get(area)
    if (!list) {
      const wars = new Set(distinctWarNames.filter(w => warNameMatchesArea(w, area)))
      list = aaQuests.filter(q => wars.has(q.warLongName))
      areaCandidatesCache.set(area, list)
    }
    return list
  }

  // Parse quests and drop rates
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 4) continue

    const area = row[0]
    const questName = row[1]
    const ap = parseInt(row[2])
    if (!questName || isNaN(ap) || ap < 5) continue

    const questId = `${area}_${questName}`.replace(/\s/g, '_')
    if (!quests.find(q => q.id === questId)) {
      // Normalize spreadsheet quest name for better matching
      let searchName = questName
      if (area.includes('修練場')) {
        if (questName.length === 3 && (questName.endsWith('極級') || questName.endsWith('超級') || questName.endsWith('上級'))) {
           searchName = `${questName[0]}の修練場 ${questName.slice(1)}`
        }
      }

      // Match with AA quest
      // Spreadsheet area と Atlas warLongName が表記揺れする場合のエイリアスマップ:
      //   - 冠位研鑽戦 (spreadsheet) ↔ 冠位戴冠戦 (Atlas, 例: "冠位戴冠戦\nアサシン")
      //   - 修練場 (spreadsheet) ↔ 曜日クエスト (Atlas)
      // (war 条件は candidatesForArea で事前フィルタ済み)
      const aaQuestInWar = candidatesForArea(area).find(
        q => q.name === searchName || q.name.includes(searchName) || q.spotName === searchName
      )

      quests.push({
        area,
        ap,
        name: questName,
        id: questId,
        section: area.includes('修練場') ? 'Daily' : 'Free',
        aaQuestId: aaQuestInWar?.id,
        qp: qpCol >= 0 ? parseReward(row[qpCol]) : undefined,
        bondPoints: bondCol >= 0 ? parseReward(row[bondCol]) : undefined,
        exp: expCol >= 0 ? parseReward(row[expCol]) : undefined,
      } as any)
    }

    // Drop rates
    for (let j = 4; j < row.length; j++) {
      const rateStr = row[j]
      if (!rateStr) continue
      const rate = parseFloat(rateStr.replace(/,/g, ''))
      if (!isNaN(rate) && rate > 0) {
        const shortName = itemNamesInHeader[j - 4]
        const itemId = itemMap.get(shortName)
        if (itemId) {
          all_drop_rates.push({
            quest_id: questId,
            item_id: itemId,
            drop_rate: rate / 100,
          })
        }
      }
    }
  }

  console.log(`Matched ${items.length} items and ${quests.length} raw quests.`)

  // 5. Assign short quest IDs: "{sectionChar}{areaChar}{questIndexChar}" in base-36
  //    Prefix "0X" = Daily (修練場), "1X"/"2X"/... = Free
  //    This keeps IDs compact for URL params and matches the frontend's prefix-based quest grouping.
  //    レジストリ一致分は前回IDを再利用し、新規のみ採番する（世代間安定化）。
  const prevQuestIds = new Set(Object.values(registry.quests).map(e => e.id))
  const longToShortQuestId = assignQuestIds(quests, registry)
  let reusedQuestIds = 0
  for (const id of longToShortQuestId.values()) {
    if (prevQuestIds.has(id)) reusedQuestIds++
  }
  console.log(
    `Quest IDs: reused ${reusedQuestIds}, new ${longToShortQuestId.size - reusedQuestIds} (registry ${Object.keys(registry.quests).length} quests, ${Object.keys(registry.items).length} items)`
  )
  quests.forEach(q => { q.id = longToShortQuestId.get(q.id) ?? q.id })
  all_drop_rates.forEach(dr => { dr.quest_id = longToShortQuestId.get(dr.quest_id) ?? dr.quest_id })

  // NEW バッジ用: レジストリの addedAt（新規ID割当日）を公開 Quest へ射影する。
  // 合成レジストリ由来の既存クエストには addedAt が無く、その場合は未設定のまま。
  // ⚠️ rarity fingerprint(computeRaritySourceFingerprint)は quests の id/ap しか
  // 見ないため、addedAt の有無/変化で再計算は走らない。指紋入力に含めないこと。
  quests.forEach(q => {
    const addedAt = registry.quests[questKey(q.area, q.name)]?.addedAt
    if (addedAt != null) q.addedAt = addedAt
  })

  // 6. Filter Candidates
  const { quests: finalQuests, drop_rates: filtered_drop_rates } = filterCandidateQuests(
    quests,
    all_drop_rates
  )

  console.log(`Filtering complete: ${finalQuests.length} quests and ${filtered_drop_rates.length} drop rate records selected.`)

  // 7. Extract AP campaigns from active events and project to short quest IDs.
  // Build the aaQuestId → short quest ID map from the final (filtered) quest set
  // so we only carry campaign data relevant to quests the solver can see.
  const aaQuestIdToShortId = new Map<number, string>()
  for (const q of finalQuests) {
    if (typeof q.aaQuestId === 'number') {
      aaQuestIdToShortId.set(q.aaQuestId, q.id)
    }
  }

  // afterClear === 'close' marks first-clear-only quests (main story, friendship,
  // certain event one-shots). Their campaign AP discounts are first-clear bonuses
  // that disappear after one run, so they have no farming value and must be
  // excluded from the campaign quest set.
  const aaQuestIdToAfterClear = new Map<number, string>()
  for (const q of aaQuests) {
    if (typeof q.id === 'number' && typeof q.afterClear === 'string') {
      aaQuestIdToAfterClear.set(q.id, q.afterClear)
    }
  }

  let campaigns: Campaign[] = []
  try {
    console.log('Fetching event data for AP campaigns from Atlas Academy...')
    const allEvents = opts.events ?? (await fetchActiveEvents())
    campaigns = extractApCampaigns(allEvents, aaQuestIdToShortId, aaQuestIdToAfterClear)
    console.log(`Extracted ${campaigns.length} questAp campaigns covering ${aaQuestIdToShortId.size} mappable quests.`)
  } catch (e) {
    console.warn('Failed to fetch/parse active events for campaigns:', e)
  }

  // クエストごとの waveCount(=ターン数)を付与(周回効率の分母に使う)。
  try {
    const { pod, fetched, cached, deferred } = await populateWaveCounts(finalQuests, {
      seed: opts.waveCountSeed,
      maxFetch: opts.waveCountMaxFetch,
    })
    console.log(
      `Wave counts: ${pod} pod quests (1 turn), ${cached} from cache, ${fetched} fetched from Atlas, ${deferred} deferred to next run.`
    )
  } catch (e) {
    console.warn('Failed to populate wave counts:', e)
  }

  return {
    items: items,
    quests: finalQuests,
    drop_rates: filtered_drop_rates,
    campaigns,
    id_registry: registry,
  }
}

export function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const nextChar = csv[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentField)
        if (currentRow.length > 0) rows.push(currentRow)
        currentRow = []
        currentField = ''
        if (char === '\r' && nextChar === '\n') i++
      } else {
        currentField += char
      }
    }
  }
  if (currentRow.length > 0 || currentField) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }
  return rows
}
