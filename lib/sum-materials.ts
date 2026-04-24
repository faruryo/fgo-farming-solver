import { range } from '../utils/range'
import { entries } from '../utils/typed-entries'
import { ChaldeaState } from '../hooks/create-chaldea-state'
import { MaterialsForServants } from './get-materials'

export const sumMaterials = (
  state: ChaldeaState,
  servantMaterials: MaterialsForServants
) => {
  const sum = new Proxy<{ [itemId: string | symbol]: number }>(
    {},
    {
      get: (target, name) => (name in target ? target[name] : 0),
    }
  )
  Object.entries(state)
    .filter(([id, { disabled }]) => !disabled && id in servantMaterials)
    .forEach(([id, { targets }]) => {
      const servant = servantMaterials[id]
      entries(targets)
        .filter(
          ([target, { disabled }]) =>
            !disabled && `${target}Materials` in servant
        )
        .forEach(([target, { ranges }]) => {
          ranges.forEach(({ start, end }, idx) => {
            const key = target === 'appendSkill' ? `appendSkill${idx + 1}Materials` : `${target}Materials`
            const materials = servant[key as keyof typeof servant]
            if (!materials) return

            range(start, end)
              .filter((i) => i in (materials as any))
              .forEach((i) => {
                const { items, qp } = (materials as any)[i]
                items.forEach(({ item, amount }: any) => {
                  sum[item.id] += amount
                })
                sum[1] += qp
              })
          })
        })
    })
  return sum
}
