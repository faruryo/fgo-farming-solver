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
  drop_rate: number
}

export interface MasterData {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1CmH3z71ymRJMlBO11cBthABxKuqdHrzXwiKa3cqRrMQ/export?format=csv&gid=201578503'

export async function fetchAndTransformData(): Promise<MasterData> {
  // 1. Fetch Item metadata from Atlas Academy
  const itemsResponse = await fetch(`${origin}/export/${region}/nice_item.json`)
  const aaItems = (await itemsResponse.json()) as any[]
  
  // 2. Fetch Quest metadata from Atlas Academy (for area names etc)
  const warsResponse = await fetch(`${origin}/export/${region}/nice_war.json`)
  const aaWars = (await warsResponse.json()) as any[]

  // 3. Fetch Drop Data from Spreadsheet
  const sheetResponse = await fetch(SHEET_URL)
  const csv = await sheetResponse.text()
  const rows = parseCSV(csv)

  // 4. Transform
  const items: Item[] = []
  const quests: Quest[] = []
  const drop_rates: DropRate[] = []

  // Skip header rows (assuming row 0 is title, row 1 is item names)
  const itemNamesInHeader = rows[1].slice(4) // Columns from index 4 are items
  
  // Create item mapping
  const itemMap = new Map<string, string>()
  for (const name of itemNamesInHeader) {
    if (!name) continue
    const aaItem = aaItems.find(i => i.name === name)
    if (aaItem) {
      const id = aaItem.id.toString()
      items.push({ category: aaItem.type, name, id })
      itemMap.set(name, id)
    }
  }

  // Parse quests and drop rates
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 4) continue

    const area = row[0]
    const questName = row[1]
    const ap = parseInt(row[2])
    const sample = row[3]

    if (!questName || isNaN(ap) || ap < 20) continue

    const questId = `${area}_${questName}`.replace(/\s/g, '_')
    quests.push({
      area,
      ap,
      name: questName,
      id: questId,
      section: area.includes('修練場') ? 'Daily' : 'Free'
    })

    // Drop rates
    for (let j = 4; j < row.length; j++) {
      const rateStr = row[j]
      const rate = parseFloat(rateStr)
      if (!isNaN(rate) && rate > 0) {
        const itemName = itemNamesInHeader[j - 4]
        const itemId = itemMap.get(itemName)
        if (itemId) {
          drop_rates.push({
            quest_id: questId,
            item_id: itemId,
            drop_rate: rate / 100 // Convert percentage to raw expectation
          })
        }
      }
    }
  }

  return { items, quests, drop_rates }
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
