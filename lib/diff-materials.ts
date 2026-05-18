import { range } from '../utils/range'
import { TargetKey } from '../interfaces/atlas-academy'
import { ReducedMaterials, ReducedMaterialsRecord } from './get-materials'

export type MaterialDeltaItem = {
  itemId: string
  amount: number
}

export type MaterialDelta = {
  items: MaterialDeltaItem[]
  direction: 'consume' | 'return'
  // Absolute step range, always [low, high] with low < high.
  stepLow: number
  stepHigh: number
}

const pickMaterials = (
  servantMaterials: ReducedMaterialsRecord,
  target: TargetKey
): ReducedMaterials | undefined => {
  if (target === 'appendSkill') return servantMaterials.appendSkillMaterials
  if (target === 'skill') return servantMaterials.skillMaterials
  return servantMaterials.ascensionMaterials
}

const accumulate = (
  materials: ReducedMaterials,
  low: number,
  high: number
): MaterialDeltaItem[] => {
  const totals: Record<string, number> = {}
  range(low, high).forEach((lv) => {
    const step = materials[lv.toString()]
    if (!step) return
    step.items.forEach(({ item, amount }) => {
      const id = item.id.toString()
      totals[id] = (totals[id] || 0) + amount
    })
    if (step.qp) {
      totals['1'] = (totals['1'] || 0) + step.qp
    }
  })
  return Object.entries(totals).map(([itemId, amount]) => ({ itemId, amount }))
}

export const diffMaterialsForStartChange = (
  servantMaterials: ReducedMaterialsRecord | undefined,
  target: TargetKey,
  prevStart: number,
  newStart: number
): MaterialDelta | null => {
  if (!servantMaterials) return null
  if (prevStart === newStart) return null

  const materials = pickMaterials(servantMaterials, target)
  if (!materials) return null

  const direction: 'consume' | 'return' =
    newStart > prevStart ? 'consume' : 'return'
  const stepLow = Math.min(prevStart, newStart)
  const stepHigh = Math.max(prevStart, newStart)

  const items = accumulate(materials, stepLow, stepHigh)
  if (items.length === 0) return null

  return { items, direction, stepLow, stepHigh }
}
