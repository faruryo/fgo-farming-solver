import { origin, region } from '../../constants/atlasacademy'
import { Item as AtlasItem } from '../../interfaces/atlas-academy'
import { toApiItemId } from '../to-api-item-id'

export interface Item {
  category: string
  name: string
  id: string
}

export interface Quest {
  area: string
  ap: number
  name: string
  id: string
  section: string
}

export interface DropRate {
  quest_id: string
  item_id: string
  drop_rate: number
}

export interface MasterData {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
}

export interface DashboardEvent {
  id: number
  name: string
  banner: string
  startedAt: number
  endedAt: number
  shopFinishedAt: number
  type: string
  drops: { id: number; name: string; icon: string }[]
}

export interface DashboardGacha {
  id: number
  name: string
  banner: string
  openedAt: number
  closedAt: number
  pickupServants: { id: number; name: string; rarity: number; face: string }[]
}

export interface DashboardMeta {
  events: DashboardEvent[]
  gachas: DashboardGacha[]
  updatedAt: number
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQerC77YrlI1wQaJHUlDl3VBNh3zx6YDWbF8syDM3DsoG3npubnlG68VY9GlYwRAiP5RCOqQEHZoF4c/pub?gid=1085791724&output=csv'

// Short name mapping for items that don't match by simple substring
const NAME_OVERRIDES: Record<string, string> = {
  // 汎用素材
  '証': '英雄の証',
  '骨': '凶骨',
  '牙': '竜の牙',
  '塵': '虚影の塵',
  '鎖': '愚者の鎖',         // 旧: 死の棲む鎖
  '毒針': '万死の毒針',
  '髄液': '魔術髄液',
  '鉄杭': '宵哭きの鉄杭',
  '火薬': '励振火薬',
  '小鐘': '赦免の小鐘',
  '剣': '黄昏の儀式剣',
  '灰': '忘れじの灰',
  '刃': '黒曜鋭刃',
  '残滓': '狂気の残滓',
  '種': '世界樹の種',
  'ﾗﾝﾀﾝ': 'ゴーストランタン',
  '八連': '八連双晶',
  '蛇玉': '蛇の宝玉',
  '羽根': '鳳凰の羽根',
  '頁': '禁断の頁',          // 旧: 禁じられた頁
  '歯車': '無間の歯車',
  '幼角': '戦馬の幼角',
  '脂': '黒獣脂',
  'ﾗﾝﾌﾟ': '封魔のランプ',
  'ｽｶﾗﾍﾞ': '智慧のスカラベ',
  'カケラ': '煌星のカケラ',
  '実': '悠久の実',
  '鬼灯': '鬼炎鬼灯',        // 旧: 禍罪の鬼灯
  '釜': '黄金釜',              // 旧: 誤って夢幻の鱗粉にマッピングされていた
  '月光': '月光核',
  '聖水': '天命の聖水',      // 旧: 神輝聖晶石
  '箱': '遺霊箱',            // 旧: 未知の箱
  'ホム': 'ホムンクルスベビー',
  '蹄鉄': '隕蹄鉄',
  '勲章': '大騎士勲章',
  '勾玉': '枯淡勾玉',
  '結氷': '永遠結氷',
  'ｵｰﾛﾗ': 'オーロラ鋼',
  '矢尻': '禍罪の矢尻',
  '冠': '光銀の冠',
  '霊子': '神脈霊子',
  '糸玉': '虹の糸玉',
  '鱗粉': '夢幻の鱗粉',
  // 新追加素材
  '貝殻': '追憶の貝殻',
  '指輪': '巨人の指輪',
  '鈴': '閑古鈴',
  '皮': '太陽皮',
  '花': '終の花',
  '爪': '混沌の爪',
  '心臓': '蛮神の心臓',
  '逆鱗': '竜の逆鱗',
  '根': '精霊根',
  '涙石': '血の涙石',
  '産毛': '原初の産毛',
  '胆石': '呪獣胆石',
  '神酒': '奇奇神酒',
  '炉心': '暁光炉心',
  '鏡': '九十九鏡',
  '卵': '真理の卵',
  'ｷｭｰﾌﾞ': 'ユニバーサルキューブ',
  'ﾚﾝｽﾞ': '神彩のレンズ',
}

// Special normalization for class items
export function normalizeItemName(shortName: string): string {
  if (NAME_OVERRIDES[shortName]) return NAME_OVERRIDES[shortName]
  
  const classMap: Record<string, string> = {
    '剣': 'セイバー',
    '弓': 'アーチャー',
    '槍': 'ランサー',
    '騎': 'ライダー',
    '術': 'キャスター',
    '殺': 'アサシン',
    '狂': 'バーサーカー'
  }

  // ピース/モニュメントはクラス名を使う（セイバーピース）
  const classNameSuffixes: Record<string, string> = {
    'ピ': 'ピース',
    'モ': 'モニュメント'
  }
  // 輝石/魔石/秘石は兵種名をそのまま使う（剣の輝石、弓の魔石）
  const weaponNameSuffixes: Record<string, string> = {
    '輝': 'の輝石',
    '魔': 'の魔石',
    '秘': 'の秘石',
  }

  for (const [s, fullSuffix] of Object.entries(classNameSuffixes)) {
    if (shortName.endsWith(s)) {
      const prefix = shortName.slice(0, -s.length)
      if (classMap[prefix]) {
        return classMap[prefix] + fullSuffix
      }
    }
  }
  for (const [s, fullSuffix] of Object.entries(weaponNameSuffixes)) {
    if (shortName.endsWith(s)) {
      const prefix = shortName.slice(0, -s.length)
      if (classMap[prefix]) {
        return prefix + fullSuffix  // 剣 + の輝石 = 剣の輝石
      }
    }
  }

  return shortName
}

// Subset of AtlasItem fields returned by nice_item.json that we need
type AAItem = Pick<AtlasItem, 'id' | 'name' | 'background' | 'priority'> & { type: string }

export async function fetchAndTransformData(): Promise<MasterData> {
  console.log('Fetching item metadata from Atlas Academy...')
  const itemsResponse = await fetch(`${origin}/export/${region}/nice_item.json`)
  const aaItems: AAItem[] = await itemsResponse.json()
  console.log(`Fetched ${aaItems.length} items from Atlas Academy.`)

  // Use the same type filter and sort order as getLocalItems() so that toApiItemId()
  // produces identical IDs on both the KV-write side and the page-display side.
  const FARMING_ITEM_TYPES = new Set(['qp', 'skillLvUp', 'tdLvUp'])
  const aaItemsForId = aaItems
    .filter(i => FARMING_ITEM_TYPES.has(i.type))
    .sort((a, b) => a.priority - b.priority)
  
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
      // Use toApiItemId with the same filtered+sorted list that getLocalItems() uses,
      // so IDs are consistent between KV data and the farming page display.
      const id = toApiItemId(aaItem as AtlasItem, aaItemsForId as AtlasItem[])
      if (!id) continue
      if (!items.find(i => i.id === id)) {
        items.push({ category: aaItem.type, name: aaItem.name, id })
      }
      itemMap.set(shortName, id)
    }
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
      quests.push({
        area,
        ap,
        name: questName,
        id: questId,
        section: area.includes('修練場') ? 'Daily' : 'Free'
      })
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
  //    Prefix "0X" = Daily (修練場), "1X"/"2X"/... = Free (by area order)
  //    This keeps IDs compact for URL params and matches the frontend's prefix-based quest grouping.
  const dailyAreas = [...new Set(quests.filter(q => q.section === 'Daily').map(q => q.area))].sort()
  const freeAreas = [...new Set(quests.filter(q => q.section !== 'Daily').map(q => q.area))].sort()
  const areaPrefix = new Map<string, string>()
  dailyAreas.forEach((area, i) => areaPrefix.set(area, '0' + i.toString(36)))
  freeAreas.forEach((area, i) => {
    areaPrefix.set(area, (Math.floor(i / 36) + 1).toString(36) + (i % 36).toString(36))
  })
  const questIndexInArea = new Map<string, number>()
  const longToShortQuestId = new Map<string, string>()
  for (const q of quests) {
    const idx = questIndexInArea.get(q.area) ?? 0
    longToShortQuestId.set(q.id, (areaPrefix.get(q.area) ?? '?') + idx.toString(36))
    questIndexInArea.set(q.area, idx + 1)
  }
  quests.forEach(q => { q.id = longToShortQuestId.get(q.id) ?? q.id })
  all_drop_rates.forEach(dr => { dr.quest_id = longToShortQuestId.get(dr.quest_id) ?? dr.quest_id })

  // 6. Filter Candidates
  // Strategy:
  // A. Keep Top 5 quests per item (by absolute drop rate) to ensure each item is farmable efficiently
  // B. Keep Top 100 quests by 'Relative Efficiency Score' to include multi-drop heavens

  const selectedQuestIds = new Set<string>()

  // A. Top 5 per item
  const itemToRates: Record<string, DropRate[]> = {}
  for (const dr of all_drop_rates) {
    if (!itemToRates[dr.item_id]) itemToRates[dr.item_id] = []
    itemToRates[dr.item_id].push(dr)
  }

  for (const itemId in itemToRates) {
    const rates = [...itemToRates[itemId]]
    rates.sort((a, b) => b.drop_rate - a.drop_rate)
    rates.slice(0, 5).forEach(dr => selectedQuestIds.add(dr.quest_id))
  }

  // B. Relative Efficiency Score (Multi-drop heaven)
  // This metric treats every item as equally important by normalizing its efficiency
  // relative to the best known quest for that specific item.
  
  // 1. Find the best efficiency (drop/AP) for each item
  const bestEfficiencyPerItem: Record<string, number> = {}
  for (const dr of all_drop_rates) {
    const quest = quests.find(q => q.id === dr.quest_id)
    if (quest) {
      const efficiency = dr.drop_rate / quest.ap
      bestEfficiencyPerItem[dr.item_id] = Math.max(bestEfficiencyPerItem[dr.item_id] || 0, efficiency)
    }
  }

  // 2. Score each quest by the sum of its relative efficiencies
  const questToRelativeScore: Record<string, number> = {}
  for (const dr of all_drop_rates) {
    const quest = quests.find(q => q.id === dr.quest_id)
    const bestEff = bestEfficiencyPerItem[dr.item_id]
    if (quest && bestEff > 0) {
      const relativeEff = (dr.drop_rate / quest.ap) / bestEff
      questToRelativeScore[dr.quest_id] = (questToRelativeScore[dr.quest_id] || 0) + relativeEff
    }
  }

  // 3. Take Top 100 quests by relative score
  const sortedByScore = Object.entries(questToRelativeScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
  
  sortedByScore.forEach(([qid]) => selectedQuestIds.add(qid))

  // Final Filter: Include all drop rates for selected quests
  const filtered_drop_rates = all_drop_rates.filter(dr => selectedQuestIds.has(dr.quest_id))
  const finalQuests = quests.filter(q => selectedQuestIds.has(q.id))

  console.log(`Filtering complete: ${finalQuests.length} quests and ${filtered_drop_rates.length} drop rate records selected.`)

  return {
    items: items,
    quests: finalQuests,
    drop_rates: filtered_drop_rates
  }
}

interface AtlasEvent {
  id: number
  name: string
  banner?: string
  startedAt: number
  endedAt: number
  shopFinishedAt: number
  type: string
  quests?: {
    drops?: {
      objectId: number
      name: string
      icon: string
    }[]
  }[]
}

interface AtlasGacha {
  id: number
  name: string
  banner?: string
  openedAt: number
  closedAt: number
  pickupServants?: {
    id: number
    name: string
    rarity: number
    face: string
  }[]
}

export async function fetchDashboardMeta(): Promise<DashboardMeta> {
  const now = Math.floor(Date.now() / 1000)
  
  console.log('Fetching event and gacha data from Atlas Academy...')
  const [eventsRes, gachaRes] = await Promise.all([
    fetch(`${origin}/export/${region}/nice_event.json`),
    fetch(`${origin}/export/${region}/nice_gacha.json`)
  ])
  
  const allEvents: AtlasEvent[] = await eventsRes.json()
  const allGachas: AtlasGacha[] = await gachaRes.json()
  
  // Filter active events (require banner)
  const activeEvents = allEvents
    .filter(e => e.startedAt <= now && e.shopFinishedAt > now && e.banner)
    .map(e => ({
      id: e.id,
      name: e.name,
      banner: e.banner as string,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      shopFinishedAt: e.shopFinishedAt,
      type: e.type,
      drops: Array.from(new Map(
        (e.quests || []).flatMap(q => q.drops || [])
          .map(d => [d.objectId, { id: d.objectId, name: d.name, icon: d.icon }])
      ).values())
    }))

  // Filter active gachas (require banner)
  const activeGachas = allGachas
    .filter(g => g.openedAt <= now && g.closedAt > now && g.banner)
    .map(g => ({
      id: g.id,
      name: g.name,
      banner: g.banner as string,
      openedAt: g.openedAt,
      closedAt: g.closedAt,
      pickupServants: (g.pickupServants || []).map(s => ({
        id: s.id,
        name: s.name,
        rarity: s.rarity,
        face: s.face
      }))
    }))

  return {
    events: activeEvents,
    gachas: activeGachas,
    updatedAt: Date.now()
  }
}

function parseCSV(csv: string): string[][] {
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
