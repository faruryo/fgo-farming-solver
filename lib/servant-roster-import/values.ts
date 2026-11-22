/**
 * カードの文字の帯の読みから Lv と宝具Lv を決める純粋関数。
 * 「今の値/上限」の形の数字だけを使い、まわりの文字（「Lv」「宝具」など）は種類の見分けの「宝」「具」にしか使わない。
 */

import { SERVANT_LV_MAX, SERVANT_LV_MIN, SERVANT_NP_LV_MIN } from '../servant-levels'
import { SKILL_LV_RANGE } from './constants'
import type { CardValues, OcrBox, RosterScreen, SkillLevels, ValueFailure, ValueRead } from './types'

/** 宝具Lv の上限 */
const NP_LV_CAP = 5

/** Lv の上限になりうる数か（20 から 90 までの 5 刻みと、92 から 120 までの 2 刻み） */
export const isPossibleLvCap = (max: number): boolean =>
  Number.isInteger(max) &&
  ((max >= 20 && max <= 90 && max % 5 === 0) || (max >= 92 && max <= SERVANT_LV_MAX && max % 2 === 0))

/** 「数字/数字」の1つの読み（確からしさは、その読みにかかる枠のいちばん低い値） */
export type FractionMatch = { current: number; max: number; confidence: number }

/** 枠を左から並べて空白でつないだ文字と、文字の位置ごとの枠の確からしさ */
const joinBoxes = (boxes: readonly OcrBox[]): { text: string; spans: { start: number; end: number; confidence: number }[] } => {
  const sorted = [...boxes].sort((a, b) => a.x - b.x)
  const spans: { start: number; end: number; confidence: number }[] = []
  let text = ''
  for (const box of sorted) {
    if (text) text += ' '
    spans.push({ start: text.length, end: text.length + box.text.length, confidence: box.confidence })
    text += box.text
  }
  return { text, spans }
}

// 「数字/数字」の形は正規表現でなく1文字ずつ見て探す（長い数字の並びで後戻りが増えないように）
const isDigit = (ch: string) => ch >= '0' && ch <= '9'
const isSpace = (ch: string) => ch !== '' && ch.trim() === ''
const isAllDigits = (text: string) => [...text].every(isDigit)

/** 文字の位置 from から step の向きに、空白を飛ばして続く数字の範囲（数字が無ければ null。範囲の外の charAt は空文字） */
const digitsFrom = (text: string, from: number, step: 1 | -1): { start: number; end: number } | null => {
  let i = from
  while (isSpace(text.charAt(i))) i += step
  const first = i
  while (isDigit(text.charAt(i))) i += step
  if (i === first) return null
  return step === 1 ? { start: first, end: i } : { start: i + 1, end: first + 1 }
}

/** 「数字/数字」の形の位置（重ならないように左から） */
const fractionSpans = (text: string) => {
  const out: { start: number; end: number; current: number; max: number }[] = []
  let consumed = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (ch !== '/' && ch !== '／') continue
    const left = digitsFrom(text, i - 1, -1)
    const right = digitsFrom(text, i + 1, 1)
    if (!left || !right || left.start < consumed) continue
    out.push({
      start: left.start,
      end: right.end,
      current: Number(text.slice(left.start, left.end)),
      max: Number(text.slice(right.start, right.end)),
    })
    consumed = right.end
  }
  return out
}

/** 文字の並びから「数字/数字」の形をすべて取り出す（枠をまたぐ形は、かかる枠のいちばん低い確からしさにする） */
export const findFractions = (boxes: readonly OcrBox[]): FractionMatch[] => {
  const { text, spans } = joinBoxes(boxes)
  return fractionSpans(text).map(({ start, end, current, max }) => ({
    current,
    max,
    confidence: Math.min(...spans.filter((s) => s.start < end && s.end > start).map((s) => s.confidence)),
  }))
}

/** 一番確からしい「数字/数字」（同じ確からしさなら先のもの）。無ければ null */
export const bestFraction = (boxes: readonly OcrBox[]): FractionMatch | null =>
  findFractions(boxes).reduce<FractionMatch | null>((best, m) => (best && best.confidence >= m.confidence ? best : m), null)

type BandValue = { kind: 'lv' | 'npLv'; read: ValueRead } | { kind: 'failure'; failure: ValueFailure }

const inRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max

/** 1つの帯の値。「数字/数字」が無ければ null */
const readBand = (boxes: readonly OcrBox[]): (BandValue & { confidence: number }) | null => {
  const match = bestFraction(boxes)
  if (!match) return null
  const { max, confidence } = match
  const hasNpMark = boxes.some((b) => /[宝具]/.test(b.text))
  const npBand = max === NP_LV_CAP && hasNpMark
  // 「宝具Lv.1/5」の「.」を 5 と読んで「51/5」になったときだけ、「/」のすぐ左の1文字を使う
  const current = npBand && match.current >= 50 && match.current <= 59 ? match.current % 10 : match.current
  const read = { current, max }
  if (npBand) {
    if (inRange(current, SERVANT_NP_LV_MIN, NP_LV_CAP)) return { kind: 'npLv', read, confidence }
    return { kind: 'failure', failure: { kind: 'npLv', ...read }, confidence }
  }
  if (isPossibleLvCap(max) && inRange(current, SERVANT_LV_MIN, max)) return { kind: 'lv', read, confidence }
  return { kind: 'failure', failure: { kind: max <= NP_LV_CAP ? 'npLv' : 'lv', ...read }, confidence }
}

/**
 * スキル強化の画面のカードの下の帯から、「数字/数字/数字」の形のスキル1〜3の Lv を読む。
 * 形が無いか、どれかがスキルLv の範囲（1〜10）の外なら null
 */
export const readSkillLevels = (boxes: readonly OcrBox[]): SkillLevels | null => {
  const plain = joinBoxes(boxes).text.replaceAll('／', '/').replace(/\s+/g, '')
  const slashes: number[] = []
  for (let i = 0; i < plain.length; i++) if (plain.charAt(i) === '/') slashes.push(i)
  for (const [k, a] of slashes.entries()) {
    const b = slashes.at(k + 1)
    if (b === undefined) break
    // 前の区切りの右と後ろの区切りの左だけの数字を使う（「Lv10/10/9」の「Lv」などを除く）
    const first = digitsFrom(plain, a - 1, -1)
    const third = digitsFrom(plain, b + 1, 1)
    const second = plain.slice(a + 1, b)
    if (!first || !third || second === '' || !isAllDigits(second)) continue
    const levels = [plain.slice(first.start, first.end), second, plain.slice(third.start, third.end)].map(Number)
    if (levels.every((v) => inRange(v, SKILL_LV_RANGE.min, SKILL_LV_RANGE.max))) return levels as SkillLevels
  }
  return null
}

/**
 * カードの上と下の帯の読みから Lv と宝具Lv を決める。
 * スキル強化の画面（screen が skill）では、下の帯はスキルLv だけを読み、Lv は読まない。
 * 「数字/数字」の形が読めた帯は、必ず値（`lv` か `npLv`）か、値を決めなかった読み（`failures`）のどちらかになる。
 * 同じ種類の値が両方の帯から読めたときは、確からしいほうを使う。
 */
export const readCardValues = (
  top: readonly OcrBox[],
  bottom: readonly OcrBox[],
  screen: RosterScreen = 'enhance',
): CardValues => {
  const skill = screen === 'skill'
  const bands = [readBand(top), skill ? null : readBand(bottom)].filter((b) => b !== null)
  const best = (kind: 'lv' | 'npLv'): ValueRead | null =>
    bands.reduce<{ read: ValueRead; confidence: number } | null>(
      (acc, b) => (b.kind === kind && (!acc || b.confidence > acc.confidence) ? b : acc),
      null,
    )?.read ?? null
  return {
    lv: best('lv'),
    npLv: best('npLv'),
    skills: skill ? readSkillLevels(bottom) : null,
    failures: bands.flatMap((b) => (b.kind === 'failure' ? [b.failure] : [])),
  }
}
