import { origin, region } from '../../constants/atlasacademy'

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
  drop_rate_1: number
  drop_rate_2: number
}

export interface MasterData {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQerC77YrlI1wQaJHUlDl3VBNh3zx6YDWbF8syDM3DsoG3npubnlG68VY9GlYwRAiP5RCOqQEHZoF4c/pub?gid=1085791724&output=csv'

// Short name mapping for items that don't match by simple substring
const NAME_OVERRIDES: Record<string, string> = {
  '証': '英雄の証',
  '骨': '凶骨',
  '牙': '竜の牙',
  '塵': '虚影の塵',
  '鎖': '死の棲む鎖',
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
  '頁': '禁じられた頁',
  '歯車': '無間の歯車',
  '幼角': '戦馬の幼角',
  '脂': '黒獣脂',
  'ﾗﾝﾌﾟ': '封魔のランプ',
  'ｽｶﾗﾍﾞ': '智慧のスカラベ',
  'カケラ': '煌星のカケラ',
  '実': '悠久の実',
  '鬼灯': '禍罪の鬼灯',
  '釜': '夢幻の鱗粉',
  '月光': '月光核',
  '聖水': '神輝聖晶石',
  '箱': '未知の箱',
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

  const suffixMap: Record<string, string> = {
    '輝': 'の輝石',
    '魔': 'の魔石',
    '秘': 'の秘石',
    'ピ': 'ピース',
    'モ': 'モニュメント'
  }

  for (const [s, fullSuffix] of Object.entries(suffixMap)) {
    if (shortName.endsWith(s)) {
      const prefix = shortName.slice(0, -s.length)
      if (classMap[prefix]) {
        return classMap[prefix] + fullSuffix
      }
    }
  }

  return shortName
}

interface AAItem {
  id: number
  name: string
  type: string
}

export async function fetchAndTransformData(): Promise<MasterData> {
  // 1. Fetch Item metadata from Atlas Academy
  const itemsResponse = await fetch(`${origin}/export/${region}/nice_item.json`)
  const aaItems: AAItem[] = await itemsResponse.json()
  
  // 2. Fetch Drop Data from Spreadsheet
  const sheetResponse = await fetch(SHEET_URL)
  const csv = await sheetResponse.text()
  const rows = parseCSV(csv)

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
    if (!aaItem) {
      aaItem = aaItems.find(i => i.name.includes(shortName) && (i.type === 'material' || i.type === 'skill' || i.type === 'qp'))
    }

    if (aaItem) {
      const id = aaItem.id.toString()
      // Avoid duplicates
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
            drop_rate_1: rate / 100, // Convert percentage to raw expectation
            drop_rate_2: 0
          })
        }
      }
    }
  }

  // 5. Filter Candidates
  // Strategy:
  // A. Keep Top 5 quests per item (by absolute drop rate) to ensure each item is farmable efficiently
  // B. Keep Top 30 quests by 'Total Efficiency' (sum of all drop rates / AP) to include multi-drop heavens
  
  const selectedQuestIds = new Set<string>()

  // A. Top 5 per item
  const itemToRates: Record<string, DropRate[]> = {}
  for (const dr of all_drop_rates) {
    if (!itemToRates[dr.item_id]) itemToRates[dr.item_id] = []
    itemToRates[dr.item_id].push(dr)
  }

  for (const itemId in itemToRates) {
    const rates = [...itemToRates[itemId]]
    rates.sort((a, b) => b.drop_rate_1 - a.drop_rate_1)
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
      const efficiency = dr.drop_rate_1 / quest.ap
      bestEfficiencyPerItem[dr.item_id] = Math.max(bestEfficiencyPerItem[dr.item_id] || 0, efficiency)
    }
  }

  // 2. Score each quest by the sum of its relative efficiencies
  const questToRelativeScore: Record<string, number> = {}
  for (const dr of all_drop_rates) {
    const quest = quests.find(q => q.id === dr.quest_id)
    const bestEff = bestEfficiencyPerItem[dr.item_id]
    if (quest && bestEff > 0) {
      const relativeEff = (dr.drop_rate_1 / quest.ap) / bestEff
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

  return {
    items,
    quests: finalQuests,
    drop_rates: filtered_drop_rates
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
