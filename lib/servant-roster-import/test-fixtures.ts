/** テスト用のカードと画像の読みを作る */

import type {
  CardReading,
  CardValues,
  FaceMatch,
  ImageReading,
  RosterScreen,
  SkillLevels,
  SortKey,
  SortOrder,
  ValueFailure,
} from './types'

const RECT = { x: 0, y: 0, width: 199, height: 199 }

export type CardSpec = {
  /** 当てたサーヴァント。null なら顔が「要確認」 */
  servant: number | null
  lv?: [number, number]
  np?: [number, number]
  skills?: SkillLevels
  failures?: ValueFailure[]
  nearest?: number[]
  /** 読んだ選択画面（省略は enhance） */
  screen?: RosterScreen
}

export const face = (servant: number | null, nearest: number[] = []): FaceMatch =>
  servant === null
    ? { kind: 'review', reason: 'ambiguous-face', nearest, best: 8, rect: RECT }
    : { kind: 'matched', servantId: servant, best: 3, second: 25, rect: RECT }

export const values = (spec: Omit<CardSpec, 'servant'>): CardValues => ({
  lv: spec.lv ? { current: spec.lv[0], max: spec.lv[1] } : null,
  npLv: spec.np ? { current: spec.np[0], max: spec.np[1] } : null,
  skills: spec.skills ?? null,
  failures: spec.failures ?? [],
})

export const card = (imageIndex: number, row: number, column: number, spec: CardSpec): CardReading => ({
  imageIndex,
  screen: spec.screen ?? 'enhance',
  row,
  column,
  face: face(spec.servant, spec.nearest),
  values: values(spec),
  crop: `crop-${imageIndex}-${row}-${column}`,
})

/** 段ごとのカード（左の列から詰める）から画像の読みを作る */
export const image = (
  imageIndex: number,
  rows: CardSpec[][],
  sort: { key: SortKey | null; order: SortOrder | null; owned?: number | null; screen?: RosterScreen } = {
    key: 'npLv',
    order: 'desc',
  },
): ImageReading => ({
  imageIndex,
  name: `image-${imageIndex}.png`,
  screen: sort.screen ?? 'enhance',
  ownedCount: sort.owned ?? null,
  sortKey: sort.key,
  sortOrder: sort.order,
  rows: rows.map((specs, row) =>
    specs.map((spec, column) => card(imageIndex, row, column, { screen: sort.screen, ...spec })),
  ),
})
