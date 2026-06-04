import { MaterialsKey, MaterialsRecord } from '../interfaces/atlas-academy'
import { origin, region } from '../constants/atlasacademy'
import { getNiceServants } from './get-nice-servants'
import { entries, fromEntries } from '../utils/typed-entries'

export type ReducedMaterials = {
  [key: string]: {
    items: {
      item: { id: number }
      amount: number
    }[]
    qp: number
  }
}
export type ReducedMaterialsRecord = Record<MaterialsKey, ReducedMaterials>
export type MaterialsForServants = {
  [servantId: string]: ReducedMaterialsRecord
}

const reduceServant = (servant: MaterialsRecord): ReducedMaterialsRecord =>
  fromEntries(
    entries(servant)
      .filter(([key]) => key.endsWith('Materials'))
      .map(([key, value]) => [
        key,
        fromEntries(
          entries(value).map(([level, { items, qp }]) => [
            level,
            {
              items: items.map(({ item, amount }) => ({
                item: { id: item.id },
                amount,
              })),
              qp,
            },
          ])
        ),
      ])
  )

export const getMaterialsForServants =
  async (): Promise<MaterialsForServants> => {
    const servants = await getNiceServants(undefined, true)
    return Object.fromEntries(
      servants.map((servant) => [servant.id, reduceServant(servant)])
    )
  }

/**
 * 指定サーヴァント ID だけの素材を per-servant エンドポイントから取得する。
 *
 * nice_servant.json は全サーヴァント入りで 60MB 超 → Cloudflare Workers の
 * 128MB メモリ上限下で parse すると GC 暴走で CPU が膨張し exceededCpu を招く。
 * 少数(rarity サンプリングの 25 体程度)だけ必要な用途では、軽量な
 * /nice/{region}/servant/{id}(約 125KB/体)を個別取得する方が桁違いに安い。
 */
export const getMaterialsForServantIds = async (
  ids: number[],
  concurrency = 8
): Promise<MaterialsForServants> => {
  const out: MaterialsForServants = {}
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await fetch(`${origin}/nice/${region}/servant/${id}`)
          if (!res.ok) return null
          const servant = (await res.json()) as MaterialsRecord & { id: number }
          return [id.toString(), reduceServant(servant)] as const
        } catch {
          return null
        }
      })
    )
    for (const r of results) {
      if (r) out[r[0]] = r[1]
    }
  }
  return out
}
