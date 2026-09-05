export const FARMING_PURPOSES = ['training', 'reserve', 'all'] as const
export type FarmingPurpose = (typeof FARMING_PURPOSES)[number]

export const isFarmingPurpose = (value: unknown): value is FarmingPurpose =>
  typeof value === 'string' &&
  FARMING_PURPOSES.includes(value as FarmingPurpose)

export const migrateFarmingPurpose = (
  current: unknown,
  legacyAll: boolean,
  legacyStock: boolean,
): FarmingPurpose => {
  if (isFarmingPurpose(current)) return current
  if (legacyAll) return 'all'
  return legacyStock ? 'reserve' : 'training'
}
