// 縮小ガードで止めた保存の「中身の差分」を出すための純関数。shrink-guard.ts が
// 発火するかどうかの判定(件数)だけを持つのに対し、こちらは判定に一切影響しない
// 表示用の内訳を作る。window/localStorage/React には触れない。

type StorageLike = Record<string, string | null | undefined>

// 素材 1 種類ぶんの増減。delta が負なら「保存すると減る」。
export type PossessionDelta = {
  id: string
  localCount: number
  cloudCount: number
  // localCount - cloudCount（負なら減る）
  delta: number
}

import { parseRecord } from './parse'

// キー 1 つぶんの内訳。size は「数えられなかった」= null と「0 件」を区別する。
export type KeyDelta = {
  key: string
  localSize: number | null
  cloudSize: number | null
  status: 'missing' | 'shrunk' | 'grown' | 'same' | 'unknown'
}

// 所持数は数値のみ有効。null・文字列・NaN は「持っていない」= 0 として扱う。
const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

// posession の素材ごとの増減。減るものだけを、減少量の大きい順に返す。
// 同じ減少量なら id 順にして、描画のたびに並びが揺れないようにする。
// パース失敗（どちらか一方でも）は null＝差分を出せない。
export const diffPossessions = (
  next: StorageLike,
  cloud: StorageLike,
): PossessionDelta[] | null => {
  const nextMap = parseRecord(next['posession'])
  const cloudMap = parseRecord(cloud['posession'])
  if (nextMap === null || cloudMap === null) return null

  // クラウドにしか無い素材（丸ごと消えるもの）こそ主役なので、両側の id を合わせる。
  const ids = new Set([...Object.keys(nextMap), ...Object.keys(cloudMap)])

  return [...ids]
    .map((id) => {
      const localCount = toCount(nextMap[id])
      const cloudCount = toCount(cloudMap[id])
      return { id, localCount, cloudCount, delta: localCount - cloudCount }
    })
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.id.localeCompare(b.id))
}

// キーの規模の数え方:
//   - パースしてオブジェクトなら   → キー数
//   - 配列なら                     → 要素数
//   - それ以外(プリミティブ)なら   → 値が存在すれば 1
//   - キー自体が無い(空文字含む)   → 0
//   - パース失敗                   → null（測定不能。0 と偽らない）
const measureSize = (raw: string | null | undefined): number | null => {
  if (!raw) return 0
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  // JSON の null は「値なし」。1 件と数えない。
  if (parsed === null) return 0
  if (Array.isArray(parsed)) return parsed.length
  if (typeof parsed === 'object') return Object.keys(parsed).length
  return 1
}

// keys の順序をそのまま保って全キー分返す（並べ替えない）。呼び出し側が KEYS の
// 定義順で読めるほうが、どの機能のデータかを追いやすい。
export const diffKeys = (
  next: StorageLike,
  cloud: StorageLike,
  keys: readonly string[],
): KeyDelta[] =>
  keys.map((key) => {
    const localSize = measureSize(next[key])
    const cloudSize = measureSize(cloud[key])

    // クラウドにあって保存内容に無い＝キーごと消える。件数比較より先に見る。
    // 判定は findMissingKeys(shrink-guard) と同じく「文字列かどうか」で揃える。
    if (typeof cloud[key] === 'string' && typeof next[key] !== 'string') {
      return { key, localSize, cloudSize, status: 'missing' as const }
    }
    if (localSize === null || cloudSize === null) {
      return { key, localSize, cloudSize, status: 'unknown' as const }
    }
    if (localSize < cloudSize) {
      return { key, localSize, cloudSize, status: 'shrunk' as const }
    }
    if (localSize > cloudSize) {
      return { key, localSize, cloudSize, status: 'grown' as const }
    }
    return { key, localSize, cloudSize, status: 'same' as const }
  })
