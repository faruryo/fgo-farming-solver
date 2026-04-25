import { EnrichedItem } from '../../../lib/get-items'

export interface Stats {
  ownedCount: number
  skillTotal: number
  appendTotal: number
  bronze: number
  silver: number
  gold: number
  fragments: number
}

interface ServantNode {
  disabled?: boolean
  targets?: {
    skill?: {
      ranges?: Array<{ start: number | string }>
    }
    appendSkill?: {
      ranges?: Array<{ start: number | string }>
    }
  }
}

export const getStats = (storage: Record<string, string | null>, items: EnrichedItem[]): Stats | null => {
  try {
    const materialRaw = storage['material']
    const possessionRaw = storage['posession']
    
    const material = (materialRaw ? JSON.parse(materialRaw) : {}) as Record<string, ServantNode>
    const possession = (possessionRaw ? JSON.parse(possessionRaw) : {}) as Record<string, number | null>
    
    let ownedCount = 0
    let skillTotal = 0
    let appendTotal = 0

    Object.entries(material).forEach(([id, node]) => {
      if (id === 'all' || !node || node.disabled) return
      ownedCount++
      
      node.targets?.skill?.ranges?.forEach((r) => {
        skillTotal += (Number(r.start) || 1)
      })
      node.targets?.appendSkill?.ranges?.forEach((r) => {
        appendTotal += (Number(r.start) || 1)
      })
    })

    let bronze = 0
    let silver = 0
    let gold = 0
    let fragments = 0

    Object.entries(possession).forEach(([id, count]) => {
      if (typeof count !== 'number' || count <= 0) return
      const item = items.find(i => i.id.toString() === id)
      if (!item) return

      if (item.background === 'bronze') bronze += count
      else if (item.background === 'silver') silver += count
      else if (item.background === 'gold') gold += count

      if (item.priority >= 300 && item.priority < 400) {
        fragments += count
      }
    })
    
    return { ownedCount, skillTotal, appendTotal, bronze, silver, gold, fragments }
  } catch (e) {
    console.error('Failed to get stats', e)
    return null
  }
}
