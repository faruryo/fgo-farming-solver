import { range } from '../utils/range'
import { entries } from '../utils/typed-entries'
import { ChaldeaState } from '../hooks/create-chaldea-state'
import { MaterialsForServants, ReducedMaterials } from './get-materials'

export const sumMaterials = (
  state: ChaldeaState,
  servantMaterials: MaterialsForServants
) => {
  const sum: Record<string, number> = {}

  Object.entries(state).forEach(([id, s]) => {
    // Treat as Owned if disabled is explicitly false or if it's missing (legacy)
    if (s.disabled === true || id === 'all') return
    if (!(id in servantMaterials)) return

    const servant = servantMaterials[id]
    entries(s.targets).forEach(([target, t]) => {
      if (t.disabled) return
      
      t.ranges.forEach(({ start, end }, idx) => {
        const key = (target === 'appendSkill' ? `appendSkill${idx + 1}Materials` : `${target}Materials`) as keyof typeof servant
        const materials = servant[key] as ReducedMaterials | undefined
        if (!materials) return

        range(start, end).forEach((lv) => {
          const step = materials[lv.toString()]
          if (!step) return

          step.items.forEach(({ item, amount }) => {
            const itemId = item.id.toString()
            sum[itemId] = (sum[itemId] || 0) + amount
          })
          sum['1'] = (sum['1'] || 0) + step.qp
        })
      })
    })
  })

  return sum
}
