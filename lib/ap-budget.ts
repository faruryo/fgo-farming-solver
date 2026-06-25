/**
 * lib/ap-budget.ts
 *
 * 必要AP を「所持りんご（黄金の果実＝最大AP全回復）→ 残りを聖晶石」に割り当て、
 * 不足聖晶石を課金額（円）に換算する純粋関数。AP→聖晶石→円換算の単一の換算源。
 *
 * D2: 聖晶石・黄金の果実はどちらも「最大AP全回復」。白銀/青銅の果実は v1 では扱わない。
 * D3: 聖晶石単価は App Store 最大パック（¥10,000 / 168個）。価格改定で変わりうるため定数化。
 */

/** D3: App Store 最大パックの金額（円）。最大パックが最安単価。 */
export const QUARTZ_PACK_YEN = 10000
/** D3: App Store 最大パックの聖晶石個数。 */
export const QUARTZ_PACK_COUNT = 168
/** 聖晶石1個あたりの課金額（円）≒ 59.5。 */
export const QUARTZ_UNIT_YEN = QUARTZ_PACK_YEN / QUARTZ_PACK_COUNT

export type ApBudget = {
  /** 基準となる最大AP（マスターレベル由来。聖晶石・黄金の果実1個＝この値を全回復）。 */
  maxAp: number
  /** 計画の必要AP（ソルバ出力）。 */
  needAp: number
  /** 必要な全回復回数 = ⌈needAp / maxAp⌉。 */
  totalRestores: number
  /** 所持していた黄金の果実数（入力値）。 */
  goldenFruitOwned: number
  /** 実際に消費する黄金の果実数（= min(所持, 必要全回復数)）。 */
  goldenFruitUsed: number
  /** 黄金の果実で賄いきれず聖晶石で割る必要のある個数。 */
  quartzCount: number
  /** 聖晶石必要枚数を最大パック単価で金額化した目安（円、整数丸め）。 */
  yen: number
}

/**
 * 必要AP に対する AP 予算内訳を計算する。
 *
 * @param needAp           計画の必要AP（≥0）
 * @param maxAp            最大AP（マスターレベル由来。1 未満は 1 にクランプ）
 * @param goldenFruitOwned 所持黄金の果実数（≥0、端末ローカル）
 */
export const computeApBudget = (
  needAp: number,
  maxAp: number,
  goldenFruitOwned = 0,
): ApBudget => {
  const safeMaxAp = Math.max(1, Math.floor(maxAp))
  const safeNeedAp = Math.max(0, Math.floor(needAp))
  const owned = Math.max(0, Math.floor(goldenFruitOwned))

  const totalRestores = safeNeedAp > 0 ? Math.ceil(safeNeedAp / safeMaxAp) : 0
  const goldenFruitUsed = Math.min(owned, totalRestores)
  const quartzCount = totalRestores - goldenFruitUsed
  const yen = Math.round(quartzCount * QUARTZ_UNIT_YEN)

  return {
    maxAp: safeMaxAp,
    needAp: safeNeedAp,
    totalRestores,
    goldenFruitOwned: owned,
    goldenFruitUsed,
    quartzCount,
    yen,
  }
}
