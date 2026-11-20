import { STORAGE_KEYS } from '../constants/storage-keys'
import { ClassScoreState, DEFAULT_CLASS_SCORE_STATE } from './types'

export const isClassScoreState = (val: unknown): val is ClassScoreState =>
  typeof val === 'object' &&
  val !== null &&
  'classes' in val &&
  typeof val.classes === 'object' &&
  val.classes !== null

/** 保存値が ClassScoreState の形でなければ既定値として読む（`useLocalStorage` の `onGet` 用）。 */
export const classScoreStateOrDefault = (val: unknown): ClassScoreState =>
  isClassScoreState(val) ? val : DEFAULT_CLASS_SCORE_STATE

/**
 * localStorage から安全に ClassScoreState を読み出すユーティリティ。
 * SSR 環境やパース失敗時、キー欠落時でも安全にデフォルト値を返す。
 */
export const readClassScoreState = (): ClassScoreState => {
  if (typeof window === 'undefined') return DEFAULT_CLASS_SCORE_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASS_SCORE)
    if (!raw) return DEFAULT_CLASS_SCORE_STATE
    return classScoreStateOrDefault(JSON.parse(raw))
  } catch {
    return DEFAULT_CLASS_SCORE_STATE
  }
}
