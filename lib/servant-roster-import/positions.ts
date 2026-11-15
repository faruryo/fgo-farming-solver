/**
 * 段の中の位置ごとに、顔の照合の結果と値の読みから、取り出すカード・「要確認」のカード・捨てる位置を決める純粋関数。
 * どのサーヴァントにも近くなく、「今の値/上限」の形の値も読めない位置は、カードが無い位置（一覧の最後の段の空き）として捨てる。
 * 値でない文字（空いた位置の背景の模様が「X」と読めたものなど）が読めただけの位置も捨てる。
 */
import type { CardValues, FaceMatch } from './types'

/** 「今の値/上限」の形の値が1つでも読めた（範囲で値を決めなかった読みも含む） */
export const hasCardValue = (values: CardValues): boolean =>
  values.lv !== null || values.npLv !== null || values.failures.length > 0

/** matched: 当てたカード、review: 「要確認」のカード、discard: カードが無い位置 */
export type CardPositionKind = 'matched' | 'review' | 'discard'

export const classifyCardPosition = (face: FaceMatch, values: CardValues): CardPositionKind => {
  if (face.kind === 'matched') return 'matched'
  if (face.reason === 'unknown-face' && !hasCardValue(values)) return 'discard'
  return 'review'
}
