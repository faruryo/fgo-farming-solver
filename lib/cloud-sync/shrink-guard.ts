// Pure shrink-guard logic for cloud sync: decides whether a save would wipe
// out most of what the cloud already holds. No window/localStorage access, and
// no dependency on the `items` catalog — a catalog that has not loaded yet
// would make both sides measure 0 and let the guard pass silently.

export type PayloadScale = {
  servants: number
  possessions: number
}

// 発火の下限。C - N がこれ未満なら、比率がどれだけ落ちても発火しない。
// 461→458 のような日常操作を除外するための絶対件数の緩衝帯。
export const SHRINK_MIN_DELTA = 10

// 残存率の上限。半分より多く残っていれば縮小とみなさない。
export const SHRINK_RATIO = 0.5

// 欠落キーの発火件数。1件は `migrateLocalInput` による `input` 削除という正規
// 経路が実在するため、2件以上でのみ発火させる。
export const MISSING_KEYS_THRESHOLD = 2

import { parseRecord } from './parse'

type ServantNode = {
  disabled?: boolean
}

type StorageLike = Record<string, string | null | undefined>

// 保存内容の規模を件数で測る。0(空)と null(測定不能)の区別がガードの成立条件
// なので、パース失敗を 0 に潰してはいけない。
export const measurePayload = (storage: StorageLike): PayloadScale | null => {
  const material = parseRecord(storage['material'])
  const possession = parseRecord(storage['posession'])
  if (material === null || possession === null) return null

  // stats-logic.ts の getStats と同じ除外条件。`disabled` 未定義は有効。
  const servants = Object.entries(material).filter(([id, node]) => {
    if (id === 'all' || !node) return false
    return !(node as ServantNode).disabled
  }).length

  const possessions = Object.values(possession).filter(
    (count) => typeof count === 'number' && count > 0,
  ).length

  return { servants, possessions }
}

// 判定対象は keys ∩ cloud のみ。KEYS からキーを削除したときに、旧データを持つ
// 全ユーザーで一度発火してしまうのを避ける。
export const findMissingKeys = (
  next: StorageLike,
  cloud: StorageLike,
  keys: readonly string[],
): string[] =>
  keys.filter(
    (key) => typeof cloud[key] === 'string' && typeof next[key] !== 'string',
  )

// C - N >= 10 かつ N <= C * 0.5。件数の下限と残存率の両方を満たしたときだけ。
const isShrunk = (next: number, cloud: number): boolean =>
  cloud - next >= SHRINK_MIN_DELTA && next <= cloud * SHRINK_RATIO

// servants / possessions / missingKeys は独立に成立する。片方の指標定義を誤って
// も、もう片方が事故を捕まえる。
export const isDestructiveShrink = (
  next: PayloadScale,
  cloud: PayloadScale,
  missingKeys: readonly string[],
): boolean =>
  isShrunk(next.servants, cloud.servants) ||
  isShrunk(next.possessions, cloud.possessions) ||
  missingKeys.length >= MISSING_KEYS_THRESHOLD
