/** 交換所の画面のスクリーンショットからの取り込みの共有型 */

export type { OcrBox } from '../possession-import/types'

/** 画像の上の矩形（画像座標系のピクセル） */
export type Rect = { x: number; y: number; width: number; height: number }

/** 交換所の画面の1行 */
export type ShopScreenRow = {
  name: string
  nameBox: Rect
  /** 「残り N回」の N。売り切れは 0。読めなければ null（要確認） */
  remaining: number | null
  /** 対価の数。読めなければ null */
  cost: number | null
  costBox: Rect | null
  /** 行の帯（行全体の切り抜きの表示に使う） */
  band: { top: number; bottom: number }
  /** 行の縦の位置（中心） */
  y: number
}

/** 「獲得したイベントアイテム」の欄の数 */
export type OwnedReading = { value: number; box: Rect }

/** 照合の結果（行・所持数ごと） */
export type IconDecision =
  | { kind: 'matched'; costItemId: number; best: number; second: number }
  /** 一番近い差と次に近い差の比が大きい・候補の通貨のアイコンを読み込めなかった */
  | { kind: 'review' }
  /** 対価の数が読めず切り出せない */
  | { kind: 'no-crop' }
