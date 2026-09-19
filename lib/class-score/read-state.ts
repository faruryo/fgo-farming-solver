import { STORAGE_KEYS } from '../constants/storage-keys'
import { ClassScoreState, DEFAULT_CLASS_SCORE_STATE } from './types'

const isClassScoreState = (val: unknown): val is ClassScoreState =>
  typeof val === 'object' &&
  val !== null &&
  'classes' in val &&
  typeof val.classes === 'object' &&
  val.classes !== null

/**
 * localStorage から安全に ClassScoreState を読み出すユーティリティ。
 * SSR 環境やパース失敗時、キー欠落時でも安全にデフォルト値を返す。
 */
export const readClassScoreState = (): ClassScoreState => {
  if (typeof window === 'undefined') return DEFAULT_CLASS_SCORE_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASS_SCORE)
    if (!raw) return DEFAULT_CLASS_SCORE_STATE
    const parsed: unknown = JSON.parse(raw)
    if (isClassScoreState(parsed)) {
      return parsed
    }
    return DEFAULT_CLASS_SCORE_STATE
  } catch {
    return DEFAULT_CLASS_SCORE_STATE
  }
}
