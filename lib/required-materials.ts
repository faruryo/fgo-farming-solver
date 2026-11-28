import type { ChaldeaState } from '../hooks/create-chaldea-state'
import { mergeChaldeaState } from '../hooks/use-chaldea-state-merger'
import type { MaterialsForServants } from './get-materials'
import { sumMaterials } from './sum-materials'
import { mergeMaterials } from './class-score/merge-materials'
import { sumClassScoreMaterials } from './class-score/sum'
import type { ClassScoreState } from './class-score/types'

export type RequiredMaterialsInput = {
  /** 育成ぶんの保存値。キーが無ければ null（`{}` は「必要な素材なし」として有る扱い）。 */
  servantResult: Record<string, number> | null
  /**
   * 育成ぶんが今のサーヴァントの状態から求めた値か。状態が変わって求め直しが終わっていない間は false。
   * false のあいだは、旧値があれば旧値を合算済みとして読む。
   */
  servantCurrent: boolean
  /** 旧 `material/result`（育成ぶん + その時点のクラススコアぶん）。キーが無ければ null。 */
  legacyResult: Record<string, number> | null
  classScoreState: ClassScoreState
}

export type RequiredMaterials = {
  /** 画面に出す必要数（アイテムIDごと）。 */
  total: Record<string, number>
  /** 合算に使った育成ぶん。旧値を合算済みとして読んだときは null。 */
  servant: Record<string, number> | null
  /** 合算に使ったクラススコアぶん。旧値を読んだときは足していないので空。 */
  classScore: Record<string, number>
  source: 'servant' | 'legacy'
}

/**
 * 必要数を「育成ぶん + クラススコアぶん」で求める。
 * 旧値は育成ぶんとクラススコアぶんが混ざっていて分けられないので、育成ぶんが使えない間だけ、
 * クラススコアぶんを足さずにそのまま読む。
 */
export const resolveRequiredMaterials = ({
  servantResult,
  servantCurrent,
  legacyResult,
  classScoreState,
}: RequiredMaterialsInput): RequiredMaterials => {
  if ((servantResult === null || !servantCurrent) && legacyResult !== null) {
    return { total: { ...legacyResult }, servant: null, classScore: {}, source: 'legacy' }
  }
  const servant = servantResult ?? {}
  const classScore = sumClassScoreMaterials(classScoreState)
  return { total: mergeMaterials(servant, classScore), servant, classScore, source: 'servant' }
}

/** 正の数を1つも持たなければ空とみなす。 */
export const isEmptyAmounts = (amounts: Record<string, number>): boolean =>
  !Object.values(amounts).some((n) => typeof n === 'number' && n > 0)

/**
 * `/material/result` を URL のクエリ付きで開いたときの育成ぶん。
 * 今の状態から求めた育成ぶんが空でなければそれを使い、空か、まだ求まっていなければクエリの値を使う。
 */
export const servantResultWithQuery = (
  computed: Record<string, number> | null,
  query: Record<string, number>,
): Record<string, number> => (computed !== null && !isEmptyAmounts(computed) ? computed : query)

/** 有効なサーヴァント（`all` と未所持を除く）の ID。 */
export const enabledServantIds = (state: ChaldeaState): string[] =>
  Object.entries(state)
    .filter(([id, s]) => id !== 'all' && s && !s.disabled)
    .map(([id]) => id)

/** 育成の目標（範囲が1つ以上進むもの）を持つ有効なサーヴァントがいるか。保存値は育成ぶんと同じく補ってから見る。 */
export const hasServantTargets = (stored: ChaldeaState): boolean => {
  const state = mergeChaldeaState({}, stored)
  return enabledServantIds(state).some((id) => {
    const targets = (Reflect.get(state, id) as ChaldeaState[string] | undefined)?.targets
    if (!targets || typeof targets !== 'object') return false
    return Object.values(targets).some(
      (t) => t && !t.disabled && Array.isArray(t.ranges) && t.ranges.some((r) => r && r.end > r.start),
    )
  })
}

/**
 * サーヴァントの保存値から育成ぶんを求める。素材データに無いサーヴァントは飛ばす（素材計算と同じ）。
 * 保存値の補い（アペンドスキルの枠）は育成計算機の画面と同じにする。
 */
export const computeServantResult = (
  state: ChaldeaState,
  materials: MaterialsForServants,
): Record<string, number> => sumMaterials(mergeChaldeaState({}, state), materials)
