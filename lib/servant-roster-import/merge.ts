/**
 * 画像ごとのカードの読みを、サーヴァントごとの確かめの画面の行にまとめる純粋関数。
 * 同じサーヴァントの読みは、検査に通ったもののうち一番強い組（宝具Lv、同じなら Lv が高いもの）を1つ取り込む値にする。
 * スキルLv（スキル強化の画面だけに出る）は、検査とは別に、読めた読みのうち合計が高いものを使い、
 * 育成計算機のスキルの今の値より低いスキルは Lv と同じく欄を空にして「要確認」にする。
 * 顔が「要確認」のカードは1枚ごとに1つの行にする。
 */

import { isValidServantLv, isValidServantNpLv, type ServantLevel, type ServantLevels } from '../servant-levels'
import { PASSED_CHECK, readingKey, valueOfKind, type ReadingCheck, type ValueKind } from './checks'
import type { CardReading, FaceMatch, RosterRow, SkillLevels, StoredSkills, ValueRange } from './types'

type Level = { lv: number | null; npLv: number | null }
type Entry = { reading: CardReading; check: ReadingCheck }
type Review = NonNullable<RosterRow['review']>

const KINDS: readonly ValueKind[] = ['lv', 'npLv']

/** 検査に通った種類の値（通らなかった種類は無いものとする） */
const usableLevel = ({ reading, check }: Entry): Level => ({
  lv: check.failedKinds.includes('lv') ? null : (reading.values.lv?.current ?? null),
  npLv: check.failedKinds.includes('npLv') ? null : (reading.values.npLv?.current ?? null),
})

const hasValue = (level: Level) => level.lv !== null || level.npLv !== null

/** 宝具Lv が高いほう、同じなら Lv が高いほうが前（無い値はどの値よりも低い） */
const compareStrength = (a: Level, b: Level): number =>
  (b.npLv ?? -1) - (a.npLv ?? -1) || (b.lv ?? -1) - (a.lv ?? -1)

/** 読めたスキルLv のうち合計が高いもの（同じなら初めに出たもの）。1つも読めなければ null */
const bestSkills = (entries: readonly Entry[]): SkillLevels | null => {
  const total = (skills: SkillLevels) => skills.reduce((sum, v) => sum + v, 0)
  return entries.reduce<SkillLevels | null>((best, { reading }) => {
    const skills = reading.values.skills
    return skills && (!best || total(skills) > total(best)) ? skills : best
  }, null)
}

const strongest = (entries: readonly Entry[]): Entry =>
  entries.reduce((best, e) => (compareStrength(usableLevel(e), usableLevel(best)) < 0 ? e : best))

const isValidValue = (kind: ValueKind, value: number) =>
  kind === 'lv' ? isValidServantLv(value) : isValidServantNpLv(value)

/** 読んだ値（値を決めなかった読みの今の値を含む） */
const readValue = (reading: CardReading, kind: ValueKind): number | null =>
  valueOfKind(reading.values, kind)?.current ?? reading.values.failures.find((f) => f.kind === kind)?.current ?? null

const unique = (values: readonly (number | null)[]): number[] => [
  ...new Set(values.filter((v): v is number => v !== null)),
]

/** 通らなかった種類の候補（読んだ値が範囲にあればその値と、推定した値） */
const failedCandidates = ({ reading, check }: Entry, kind: ValueKind): number[] => {
  const read = readValue(reading, kind)
  const estimated = check.estimate?.kind === kind ? check.estimate.value : null
  return unique([read, estimated]).filter((v) => isValidValue(kind, v))
}

const estimatedRange = (check: ReadingCheck, kind: ValueKind): ValueRange | null =>
  check.estimate?.kind === kind ? check.estimate.range : null

const emptyReview = (): Review => ({
  reasons: [],
  undecided: [],
  servantCandidates: [],
  lvCandidates: [],
  npLvCandidates: [],
  lvRange: null,
  npLvRange: null,
  undecidedSkills: [],
  skillCandidates: [[], [], []],
})

/** 検査に通らなかった種類の欄を空にした行の値と「要確認」 */
const failedReview = (entry: Entry): { level: Level; review: Review } => {
  const { check } = entry
  const undecided = KINDS.filter((k) => check.failedKinds.includes(k))
  return {
    level: usableLevel(entry),
    review: {
      ...emptyReview(),
      reasons: [...check.reasons],
      undecided,
      lvCandidates: undecided.includes('lv') ? failedCandidates(entry, 'lv') : [],
      npLvCandidates: undecided.includes('npLv') ? failedCandidates(entry, 'npLv') : [],
      lvRange: undecided.includes('lv') ? estimatedRange(check, 'lv') : null,
      npLvRange: undecided.includes('npLv') ? estimatedRange(check, 'npLv') : null,
    },
  }
}

/** 取り込む値を前に取り込んだ保存値と比べ、低い種類があれば欄を空にして「要確認」にする */
const compareWithStored = (level: Level, saved: ServantLevel | undefined) => {
  const valueOf = (k: ValueKind) => (k === 'lv' ? level.lv : level.npLv)
  const savedOf = (k: ValueKind) => (k === 'lv' ? saved?.lv : saved?.npLv) ?? null
  const lower = KINDS.filter((k) => {
    const value = valueOf(k)
    const before = savedOf(k)
    return value !== null && before !== null && value < before
  })
  if (lower.length === 0) return { level, review: null }
  const candidates = (k: ValueKind) => (lower.includes(k) ? unique([valueOf(k), savedOf(k)]) : [])
  return {
    level: { lv: lower.includes('lv') ? null : level.lv, npLv: lower.includes('npLv') ? null : level.npLv },
    review: {
      ...emptyReview(),
      reasons: ['lower-than-saved' as const],
      undecided: lower,
      lvCandidates: candidates('lv'),
      npLvCandidates: candidates('npLv'),
    },
  }
}

const SKILL_INDICES = [0, 1, 2]

/** 読んだスキルLv を育成計算機のスキルの今の値と比べ、低いスキルがあれば欄を空にして「要確認」にする */
const compareSkillsWithStored = (skills: SkillLevels | null, saved: readonly number[] | undefined) => {
  const lower = skills && saved ? SKILL_INDICES.filter((i) => (skills.at(i) ?? 0) < (saved.at(i) ?? 0)) : []
  if (!skills || lower.length === 0) return { skills, review: null }
  return {
    skills: skills.map((v, i) => (lower.includes(i) ? null : v)),
    review: {
      ...emptyReview(),
      reasons: ['lower-than-saved' as const],
      undecidedSkills: lower,
      skillCandidates: SKILL_INDICES.map((i) => (lower.includes(i) ? unique([skills.at(i) ?? null, saved?.at(i) ?? null]) : [])),
    },
  }
}

/** 2つの「要確認」を1つにする（どちらかが無ければもう一方） */
const combineReviews = (a: Review | null, b: Review | null): Review | null => {
  if (!a || !b) return a ?? b
  return {
    reasons: [...new Set([...a.reasons, ...b.reasons])],
    undecided: [...a.undecided, ...b.undecided],
    servantCandidates: [...a.servantCandidates, ...b.servantCandidates],
    lvCandidates: [...a.lvCandidates, ...b.lvCandidates],
    npLvCandidates: [...a.npLvCandidates, ...b.npLvCandidates],
    lvRange: a.lvRange ?? b.lvRange,
    npLvRange: a.npLvRange ?? b.npLvRange,
    undecidedSkills: [...a.undecidedSkills, ...b.undecidedSkills],
    skillCandidates: a.skillCandidates.map((c, i) => [...c, ...(b.skillCandidates.at(i) ?? [])]),
  }
}

const servantRow = (
  servantId: number,
  entries: readonly Entry[],
  stored: ServantLevels,
  storedSkills: StoredSkills,
): RosterRow => {
  const passed = entries.filter((e) => e.check.reasons.length === 0)
  const valued = passed.filter((e) => hasValue(usableLevel(e)))
  const failed = entries.filter((e) => e.check.reasons.length > 0)
  const skillCheck = compareSkillsWithStored(bestSkills(entries), storedSkills[String(servantId)])
  const base = { key: `servant-${servantId}`, servantId, skills: skillCheck.skills }
  if (valued.length > 0) {
    const chosen = strongest(valued)
    // スキル強化の画面の読みは Lv を読まないので、その読みを選んだときだけ、ほかの読みの Lv を使う
    const picked = usableLevel(chosen)
    const lvs = chosen.reading.screen === 'skill' ? valued.flatMap((e) => usableLevel(e).lv ?? []) : []
    const { level, review } = compareWithStored(
      { ...picked, lv: picked.lv ?? (lvs.length > 0 ? Math.max(...lvs) : null) },
      stored[String(servantId)],
    )
    return { ...base, ...level, review: combineReviews(review, skillCheck.review), crop: chosen.reading.crop }
  }
  if (failed.length > 0) {
    const chosen = strongest(failed)
    const failedRow = failedReview(chosen)
    // 検査に通った種類の値も、保存値より低ければ欄を空にする（利用者が空の欄を埋めたときに黙って下げないため）
    const lower = compareWithStored(failedRow.level, stored[String(servantId)])
    const review = combineReviews(combineReviews(failedRow.review, lower.review), skillCheck.review)
    return { ...base, ...lower.level, review, crop: chosen.reading.crop }
  }
  return { ...base, lv: null, npLv: null, review: skillCheck.review, crop: entries[0].reading.crop }
}

type ReviewFace = Extract<FaceMatch, { kind: 'review' }>

const faceReviewRow = (entry: Entry, face: ReviewFace): RosterRow => {
  const { reading } = entry
  const { level, review } = failedReview(entry)
  return {
    key: `card-${reading.imageIndex}-${reading.row}-${reading.column}`,
    servantId: null,
    skills: reading.values.skills,
    ...level,
    review: { ...review, reasons: [face.reason, ...review.reasons], servantCandidates: [...face.nearest] },
    crop: reading.crop,
  }
}

/**
 * カードの読みをサーヴァントごとの行にまとめる（行の並びは、読みが初めに出た順）。
 * `checks` は読みの印（`readingKey`）ごとの検査の結果。無い読みは検査に通ったものとする。
 */
export const mergeRoster = (
  readings: readonly CardReading[],
  checks: ReadonlyMap<string, ReadingCheck>,
  stored: ServantLevels,
  storedSkills: StoredSkills = {},
): RosterRow[] => {
  const groups = new Map<number, Entry[]>()
  const order: ({ kind: 'servant'; servantId: number } | { kind: 'card'; entry: Entry; face: ReviewFace })[] = []
  for (const reading of readings) {
    const entry = { reading, check: checks.get(readingKey(reading)) ?? PASSED_CHECK }
    if (reading.face.kind === 'review') {
      order.push({ kind: 'card', entry, face: reading.face })
      continue
    }
    const { servantId } = reading.face
    const group = groups.get(servantId)
    if (group) {
      group.push(entry)
    } else {
      groups.set(servantId, [entry])
      order.push({ kind: 'servant', servantId })
    }
  }
  return order.map((unit) =>
    unit.kind === 'card'
      ? faceReviewRow(unit.entry, unit.face)
      : servantRow(unit.servantId, groups.get(unit.servantId) ?? [], stored, storedSkills),
  )
}
