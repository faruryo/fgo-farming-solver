// 必要数のフック（useRequiredMaterials）を本物のまま使うテストの準備。
// *.test.ts ではないので、vitest はこのファイルをテストとして拾わない。
import { createChaldeaState, type ChaldeaState } from './create-chaldea-state'
import type { MaterialsForServants } from '../lib/get-materials'
import type { MaterialCatalogV1 } from '../lib/material-catalog'
import { computeServantResult } from '../lib/required-materials'

export const catalogOf = (materials: MaterialsForServants) =>
  ({ schemaVersion: 1, updatedAt: 0, sources: {}, servants: [], items: [], materials }) as unknown as MaterialCatalogV1

/** サーヴァント1騎の再臨 0→1 だけを目標にした状態と、その1段で amounts を使う素材データ（QP は 0）。 */
export const servantNeedOf = (amounts: Record<string, number>): { state: ChaldeaState; materials: MaterialsForServants } => {
  const state = createChaldeaState(['1'])
  state['1'].disabled = false
  state['1'].targets.ascension.ranges = [{ start: 0, end: 1 }]
  state['1'].targets.skill.disabled = true
  state['1'].targets.appendSkill.disabled = true
  const stepItems = Object.entries(amounts).map(([id, amount]) => ({ item: { id: Number(id) }, amount }))
  const materials = {
    '1': { ascensionMaterials: { '0': { items: stepItems, qp: 0 } }, skillMaterials: {}, appendSkillMaterials: {} },
  } as unknown as MaterialsForServants
  return { state, materials }
}

/**
 * 移行後の端末: 育成ぶんが amounts になるサーヴァントの状態と、その育成ぶんを localStorage に置く。
 * 返す catalog を素材データの取得（loadMaterialCatalog の mock）に返させる。
 */
export const seedServantNeed = (amounts: Record<string, number>): MaterialCatalogV1 => {
  const { state, materials } = servantNeedOf(amounts)
  localStorage.setItem('material', JSON.stringify(state))
  localStorage.setItem('material/servant-result', JSON.stringify(computeServantResult(state, materials)))
  return catalogOf(materials)
}
