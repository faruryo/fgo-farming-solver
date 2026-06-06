import type { ProgressTier } from './types'

// 「素材スループット」= 比較スナップショット以降の素材の活動量。
// reducedAp(ゴールまでの距離の縮小)と違い、所持の増減そのものを進捗とみなす:
//   - 所持が増えた分 = 獲得素材(周回)
//   - 所持が減った分 = 育成投入(霊基再臨/スキル強化等で消費)
// どちらも「活動」として加点するため、素材を育成に使った日も tier=none にならない。

// QP(atlasId '1')は所持が ~1e20、消費も数千万単位で、個数ベースの指標では
// 他素材を完全に埋もれさせる。進捗からは除外する。将来の拡張に備え集合で持つ。
const EXCLUDED_ATLAS_IDS = new Set<string>(['1'])

type CountMap = Record<string, number | string | undefined>

const toNum = (v: number | string | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? (n as number) : 0
}

export type ItemThroughput = {
  /** 所持が純増した素材の合計個数(周回で獲得)。 */
  itemsFarmed: number
  /** 所持が純減した素材の合計個数(育成に投入)。 */
  itemsConsumed: number
}

// 2スナップショット間では純差分(net)のみ観測可能。同一素材を farm して消費した
// gross は復元できないが、net で活動量の方向性は十分に表せる。
export const computeItemThroughput = (
  pastPos: CountMap | null | undefined,
  nowPos: CountMap | null | undefined
): ItemThroughput => {
  const past = pastPos ?? {}
  const now = nowPos ?? {}
  const keys = new Set<string>([...Object.keys(past), ...Object.keys(now)])
  let itemsFarmed = 0
  let itemsConsumed = 0
  for (const k of keys) {
    if (EXCLUDED_ATLAS_IDS.has(k)) continue
    const delta = toNum(now[k]) - toNum(past[k])
    if (delta > 0) itemsFarmed += delta
    else if (delta < 0) itemsConsumed += -delta
  }
  return { itemsFarmed, itemsConsumed }
}

// スループット合計(獲得 + 投入)を経過日数でならして tier を決める。
// しきい値は素材個数ベースの暫定値(実利用の体感で調整可能)。
export const classifyTierByThroughput = (
  throughput: number,
  elapsedMinutes: number
): ProgressTier => {
  if (throughput <= 0) return 'none'
  const days = Math.max(1, elapsedMinutes / 1440)
  const perDay = throughput / days
  if (perDay >= 50) return 'large'
  if (perDay >= 10) return 'medium'
  return 'small'
}
